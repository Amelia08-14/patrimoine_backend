import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AnnounceStatus, UserType, AccountStatus, CompanyActivity } from '@prisma/client';

const USER_LIST_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  companyName: true,
  commercialRegister: true,
  nif: true,
  nis: true,
  rcDocumentUrl: true,
  agreementDocumentUrl: true,
  nifDocumentUrl: true,
  nisDocumentUrl: true,
  inapiDocumentUrl: true,
  agreementExpiryDate: true,
  imageUrl: true,
  phone: true,
  townId: true,
  createdAt: true,
  lastLoginAt: true,
  userType: true,
  companyActivity: true,
  adminVerified: true,
  accountStatus: true,
  statusReason: true,
} as const;

// Segmentation des CompanyActivity en 4 pôles d'activité (dashboard "Partenaires")
export const ACTIVITY_POLES: Record<'IMMOBILIER' | 'HOTELLERIE' | 'EVENEMENTIEL' | 'ENTREPOSAGE', CompanyActivity[]> = {
  IMMOBILIER: [
    CompanyActivity.AGENCE_IMMOBILIERE,
    CompanyActivity.PROMOTEUR_IMMOBILIER,
    CompanyActivity.ADMINISTRATEUR_BIENS,
    CompanyActivity.AUTRES_PROFESSIONNELS,
  ],
  HOTELLERIE: [
    CompanyActivity.HOTELLERIE_HEBERGEMENT,
    CompanyActivity.HOTEL,
    CompanyActivity.COMPLEXE_TOURISTIQUE,
    CompanyActivity.VILLAGE_VACANCES,
    CompanyActivity.APPART_HOTEL,
    CompanyActivity.RESIDENCE_HOTELIERE,
    CompanyActivity.MOTEL,
    CompanyActivity.RELAIS_ROUTIER,
    CompanyActivity.CAMPING_TOURISTIQUE,
    CompanyActivity.AUTRES_STRUCTURES,
  ],
  EVENEMENTIEL: [
    CompanyActivity.SALLE_DES_FETES,
    CompanyActivity.SALLES_DINATOIRES,
    CompanyActivity.SALLE_FORMATION,
    CompanyActivity.SALLE_CONFERENCE,
    CompanyActivity.AUTRES_EVENEMENTIEL,
  ],
  ENTREPOSAGE: [
    CompanyActivity.ENTREPOSAGE_FRIGORIFIQUE,
    CompanyActivity.ENTREPOSAGE_NON_FRIGORIFIQUE,
    CompanyActivity.AUTRES_ENTREPOSAGE_STOCKAGE,
  ],
};

function poleForActivity(activity: CompanyActivity | null | undefined): string | null {
  if (!activity) return null;
  for (const [pole, activities] of Object.entries(ACTIVITY_POLES)) {
    if (activities.includes(activity)) return pole;
  }
  return null;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async checkAdmin(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.userType !== UserType.ADMIN) {
        throw new UnauthorizedException('Access denied. Admin only.');
    }
    return user;
  }

  // --- Résolution géographique (townId -> wilaya/commune) ---

  private async resolveTownIds(wilaya?: string, commune?: string): Promise<number[] | undefined> {
    if (commune) {
      return [Number(commune)];
    }
    if (wilaya) {
      const towns = await this.prisma.town.findMany({
        where: { cityId: Number(wilaya) },
        select: { id: true },
      });
      return towns.map((t) => t.id);
    }
    return undefined;
  }

  // --- Users Management ---

  async getAllUsers(filters?: { wilaya?: string; commune?: string; search?: string }) {
    const townIds = await this.resolveTownIds(filters?.wilaya, filters?.commune);
    const search = filters?.search?.trim();

    return this.prisma.user.findMany({
      where: {
        NOT: { userType: UserType.ADMIN },
        ...(townIds ? { townId: { in: townIds } } : {}),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { email: { contains: search } },
                { companyName: { contains: search } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: USER_LIST_SELECT,
    });
  }

  async getPendingUsers() {
    return this.prisma.user.findMany({
      where: {
        adminVerified: false,
        NOT: { userType: UserType.ADMIN },
      },
      orderBy: { createdAt: 'desc' },
      select: USER_LIST_SELECT,
    });
  }

  async validateUser(userId: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { adminVerified: true },
    });
  }

  async rejectUser(userId: number) {
    return this.prisma.user.delete({
      where: { id: userId },
    });
  }

  // --- Statuts de compte (activer / suspendre / bloquer) ---

  async updateUserStatus(userId: number, status: AccountStatus, reason?: string) {
    if (!Object.values(AccountStatus).includes(status)) {
      throw new BadRequestException('Statut invalide');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        accountStatus: status,
        statusReason: status === AccountStatus.ACTIVE ? null : (reason || null),
      },
      select: USER_LIST_SELECT,
    });
  }

  // Désactivation automatique des comptes pro dont l'agrément a expiré — tous les jours à 1h
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async deactivateExpiredAgreements() {
    const now = new Date();
    const result = await this.prisma.user.updateMany({
      where: {
        userType: UserType.SOCIETE,
        accountStatus: AccountStatus.ACTIVE,
        agreementExpiryDate: { lt: now },
      },
      data: {
        accountStatus: AccountStatus.SUSPENDED,
        statusReason: "Agrément professionnel expiré",
      },
    });
    if (result.count > 0) {
      this.logger.log(`${result.count} compte(s) professionnel(s) suspendu(s) pour agrément expiré`);
    }
    return result;
  }

  // --- Partenaires : dashboard segmenté par pôle d'activité ---

  async getPartners(filters?: {
    search?: string;
    status?: 'ALL' | 'ACTIVE' | 'PENDING' | 'SUSPENDED';
    accountType?: 'ALL' | 'PRO' | 'PARTICULIER';
    pole?: 'ALL' | keyof typeof ACTIVITY_POLES;
  }) {
    const search = filters?.search?.trim();
    const status = filters?.status || 'ALL';
    const accountType = filters?.accountType || 'ALL';
    const pole = filters?.pole || 'ALL';

    const users = await this.prisma.user.findMany({
      where: {
        NOT: { userType: UserType.ADMIN },
        ...(accountType === 'PRO' ? { userType: UserType.SOCIETE } : {}),
        ...(accountType === 'PARTICULIER' ? { userType: UserType.PARTICULIER } : {}),
        ...(status === 'ACTIVE' ? { accountStatus: AccountStatus.ACTIVE } : {}),
        ...(status === 'PENDING' ? { adminVerified: false } : {}),
        ...(status === 'SUSPENDED' ? { accountStatus: { in: [AccountStatus.SUSPENDED, AccountStatus.BLOCKED] } } : {}),
        ...(pole !== 'ALL' ? { companyActivity: { in: ACTIVITY_POLES[pole] } } : {}),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { email: { contains: search } },
                { companyName: { contains: search } },
                { phone: { contains: search } },
                { commercialRegister: { contains: search } },
                { nif: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        ...USER_LIST_SELECT,
        _count: { select: { announces: { where: { status: AnnounceStatus.VALIDATED } } } },
      },
    });

    // Résolution des localisations (townId -> wilaya/commune) en un seul aller-retour
    const townIds = [...new Set(users.map((u) => u.townId).filter((id): id is number => !!id))];
    const towns = townIds.length
      ? await this.prisma.town.findMany({
          where: { id: { in: townIds } },
          include: { city: true },
        })
      : [];
    const townMap = new Map(towns.map((t) => [t.id, t]));

    return users.map((u) => {
      // Les particuliers ne portent pas de companyActivity : faute d'un marqueur de pôle
      // dédié sur les comptes B2C, ils sont rattachés par défaut au pôle Immobilier
      // (seul pôle actuellement modélisé par les annonces/Property). À affiner si un
      // champ de pôle est ajouté pour les comptes particuliers.
      const resolvedPole = u.userType === UserType.PARTICULIER ? 'IMMOBILIER' : poleForActivity(u.companyActivity);
      const town = u.townId ? townMap.get(u.townId) : undefined;
      return {
        ...u,
        pole: resolvedPole,
        location: town ? `${town.nameFr} (${town.city.nameFr})` : null,
        announcesCount: u._count.announces,
      };
    });
  }

  // --- Announces Management ---

  async getAllAnnounces(filters?: { wilaya?: string; commune?: string; search?: string }) {
    const townIds = await this.resolveTownIds(filters?.wilaya, filters?.commune);
    const search = filters?.search?.trim();

    return this.prisma.announce.findMany({
      where: {
        ...(townIds ? { property: { address: { townId: { in: townIds } } } } : {}),
        ...(search
          ? {
              OR: [
                { reference: { contains: search } },
                { title: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, companyName: true },
        },
        property: {
          include: {
            address: {
              include: {
                town: {
                  select: {
                    id: true,
                    nameFr: true,
                    nameAr: true,
                    nameEn: true,
                    city: {
                      select: {
                        id: true,
                        nameFr: true,
                        nameAr: true,
                        nameEn: true,
                      },
                    },
                  },
                },
              },
            },
            images: true,
          },
        },
      },
    });
  }

  async getPendingAnnounces() {
    return this.prisma.announce.findMany({
      where: {
        status: AnnounceStatus.WAITING_VALIDATION,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, companyName: true },
        },
        property: {
          include: {
            address: {
              include: {
                town: {
                  select: {
                    id: true,
                    nameFr: true,
                    nameAr: true,
                    nameEn: true,
                    city: {
                      select: {
                        id: true,
                        nameFr: true,
                        nameAr: true,
                        nameEn: true,
                      },
                    },
                  },
                },
              },
            },
            images: true,
          },
        },
      },
    });
  }

  async updateAnnounceStatus(announceId: number, status: AnnounceStatus) {
    return this.prisma.announce.update({
      where: { id: announceId },
      data: { status },
    });
  }

  // --- Mise en avant "Première page" & suivi KPI ---

  async featureAnnounce(announceId: number, durationDays: number) {
    const featuredFrom = new Date();
    const featuredUntil = new Date(featuredFrom);
    featuredUntil.setDate(featuredUntil.getDate() + (durationDays > 0 ? durationDays : 30));
    return this.prisma.announce.update({
      where: { id: announceId },
      data: { featuredFrom, featuredUntil },
    });
  }

  async unfeatureAnnounce(announceId: number) {
    return this.prisma.announce.update({
      where: { id: announceId },
      data: { featuredFrom: null, featuredUntil: null },
    });
  }

  async getFeaturedKpis() {
    return this.prisma.announce.findMany({
      where: { featuredFrom: { not: null } },
      orderBy: { featuredFrom: 'desc' },
      select: {
        id: true,
        reference: true,
        title: true,
        status: true,
        nbViews: true,
        nbCalls: true,
        featuredFrom: true,
        featuredUntil: true,
        property: { select: { propertyType: true } },
      },
    });
  }

  // --- Module Contact & Support : requêtes soumises via "Nous Contacter" ---

  async getContacts(filters?: { motif?: string; status?: string }) {
    return this.prisma.contact.findMany({
      where: {
        ...(filters?.motif && filters.motif !== 'ALL' ? { motif: filters.motif } : {}),
        ...(filters?.status && filters.status !== 'ALL' ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateContactStatus(id: number, status: string) {
    if (!['NEW', 'READ', 'ARCHIVED'].includes(status)) {
      throw new BadRequestException('Statut invalide');
    }
    return this.prisma.contact.update({ where: { id }, data: { status } });
  }

  // --- Recherche rapide globale ---

  async globalSearch(query: string) {
    const q = query.trim();
    if (!q) return { users: [], announces: [] };

    const [users, announces] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          NOT: { userType: UserType.ADMIN },
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { email: { contains: q } },
            { companyName: { contains: q } },
            { phone: { contains: q } },
          ],
        },
        take: 8,
        select: {
          id: true, firstName: true, lastName: true, email: true, companyName: true, userType: true,
        },
      }),
      this.prisma.announce.findMany({
        where: {
          OR: [
            { reference: { contains: q } },
            { title: { contains: q } },
          ],
        },
        take: 8,
        select: { id: true, reference: true, title: true, status: true },
      }),
    ]);

    return { users, announces };
  }
}
