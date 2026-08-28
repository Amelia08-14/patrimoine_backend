import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AnnounceStatus, UserType, AccountStatus, CompanyActivity, TransactionType } from '@prisma/client';

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
  address: true,
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

  // --- Tableau de bord : indicateurs clés (annonces, inscriptions, répartition pro) ---

  async getDashboardStats(filters?: { from?: string; to?: string }) {
    // Filtre de période (sur createdAt) : "from"/"to" au format YYYY-MM-DD, bornes incluses.
    const from = filters?.from ? new Date(filters.from) : undefined;
    const to = filters?.to ? new Date(`${filters.to}T23:59:59.999`) : undefined;
    const createdAt = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;

    const [pendingAnnounces, onlineAnnounces, totalParticuliers, professionnels] = await Promise.all([
      this.prisma.announce.count({ where: { status: AnnounceStatus.WAITING_VALIDATION, ...(createdAt ? { createdAt } : {}) } }),
      this.prisma.announce.count({ where: { status: AnnounceStatus.VALIDATED, ...(createdAt ? { createdAt } : {}) } }),
      this.prisma.user.count({ where: { userType: UserType.PARTICULIER, ...(createdAt ? { createdAt } : {}) } }),
      this.prisma.user.findMany({ where: { userType: UserType.SOCIETE, ...(createdAt ? { createdAt } : {}) }, select: { companyActivity: true } }),
    ]);

    const professionnelsByActivity: Record<string, number> = {
      IMMOBILIER: 0,
      HOTELLERIE: 0,
      EVENEMENTIEL: 0,
      ENTREPOSAGE: 0,
      NON_CLASSE: 0,
    };
    // Détail par sous-catégorie (CompanyActivity) — toutes les valeurs de l'enum,
    // y compris à 0, pour un tableau de bord complet quelle que soit l'activité réelle.
    const professionnelsBySubCategory: Record<string, number> = {};
    for (const activity of Object.values(CompanyActivity)) {
      professionnelsBySubCategory[activity] = 0;
    }
    for (const { companyActivity } of professionnels) {
      const pole = poleForActivity(companyActivity);
      professionnelsByActivity[pole && professionnelsByActivity[pole] !== undefined ? pole : 'NON_CLASSE']++;
      if (companyActivity) professionnelsBySubCategory[companyActivity]++;
    }

    return {
      pendingAnnounces,
      totalOnlineAnnounces: onlineAnnounces,
      totalParticuliers,
      totalProfessionnels: professionnels.length,
      professionnelsByActivity,
      professionnelsBySubCategory,
    };
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

  // Vue unifiée : annuaire complet (conformité/documents) + segmentation par pôle d'activité
  async getAllUsers(filters?: {
    wilaya?: string;
    commune?: string;
    search?: string;
    status?: 'ALL' | 'ACTIVE' | 'PENDING' | 'SUSPENDED';
    accountType?: 'ALL' | 'PRO' | 'PARTICULIER';
    pole?: 'ALL' | keyof typeof ACTIVITY_POLES;
    subCategory?: CompanyActivity | 'ALL';
  }) {
    const townIds = await this.resolveTownIds(filters?.wilaya, filters?.commune);
    const search = filters?.search?.trim();
    const status = filters?.status || 'ALL';
    const accountType = filters?.accountType || 'ALL';
    const pole = filters?.pole || 'ALL';
    const subCategory = filters?.subCategory && filters.subCategory !== 'ALL' ? filters.subCategory : undefined;

    const conditions: object[] = [{ NOT: { userType: UserType.ADMIN } }];
    if (townIds) conditions.push({ townId: { in: townIds } });
    if (accountType === 'PRO') conditions.push({ userType: UserType.SOCIETE });
    if (accountType === 'PARTICULIER') conditions.push({ userType: UserType.PARTICULIER });
    if (status === 'ACTIVE') conditions.push({ accountStatus: AccountStatus.ACTIVE });
    if (status === 'PENDING') conditions.push({ adminVerified: false });
    if (status === 'SUSPENDED') conditions.push({ accountStatus: { in: [AccountStatus.SUSPENDED, AccountStatus.BLOCKED] } });
    if (subCategory) {
      // Sous-catégorie précise (affine le pôle) : ne s'applique qu'aux comptes pro, qui seuls
      // portent un companyActivity.
      conditions.push({ companyActivity: subCategory });
    } else if (pole !== 'ALL') {
      // Les particuliers n'ont pas de companyActivity mais sont rattachés par défaut au pôle
      // Immobilier (cf. resolvedPole ci-dessous) : le filtre doit donc les inclure sur ce pôle.
      conditions.push(
        pole === 'IMMOBILIER'
          ? { OR: [{ companyActivity: { in: ACTIVITY_POLES[pole] } }, { userType: UserType.PARTICULIER }] }
          : { companyActivity: { in: ACTIVITY_POLES[pole] } },
      );
    }
    if (search) {
      conditions.push({
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { email: { contains: search } },
          { companyName: { contains: search } },
          { phone: { contains: search } },
          { commercialRegister: { contains: search } },
          { nif: { contains: search } },
        ],
      });
    }

    const users = await this.prisma.user.findMany({
      where: { AND: conditions },
      orderBy: { createdAt: 'desc' },
      select: {
        ...USER_LIST_SELECT,
        _count: { select: { announces: { where: { status: AnnounceStatus.VALIDATED } } } },
      },
    });

    // Résolution des localisations (townId -> wilaya/commune) en un seul aller-retour
    const townIdsToResolve = [...new Set(users.map((u) => u.townId).filter((id): id is number => !!id))];
    const towns = townIdsToResolve.length
      ? await this.prisma.town.findMany({
          where: { id: { in: townIdsToResolve } },
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
      const structuredLocation = town ? `${town.nameFr} (${town.city.nameFr})` : null;
      // Repli sur l'adresse texte libre quand le compte n'a pas de wilaya/commune structurée
      // (champ non demandé à l'inscription) : mieux vaut afficher une info approximative
      // que rien du tout dans la colonne "Localisation".
      return {
        ...u,
        pole: resolvedPole,
        location: structuredLocation || u.address || null,
        locationIsApproximate: !structuredLocation && !!u.address,
        announcesCount: u._count.announces,
      };
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

  // --- Réinitialisation du mot de passe d'un client par l'administrateur ---

  async resetUserPassword(userId: number, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 6 caractères');
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { message: 'Mot de passe réinitialisé avec succès' };
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

  // --- Announces Management ---

  async getAllAnnounces(filters?: { wilaya?: string; commune?: string; search?: string }) {
    const townIds = await this.resolveTownIds(filters?.wilaya, filters?.commune);
    const search = filters?.search?.trim();

    const announces = await this.prisma.announce.findMany({
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
          select: { id: true, email: true, firstName: true, lastName: true, companyName: true, userType: true, companyActivity: true },
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

    // Résolution du pôle d'activité de l'annonceur, pour le filtre "Type d'activité" (dashboard admin)
    return announces.map((a) => ({
      ...a,
      user: a.user
        ? { ...a.user, pole: a.user.userType === UserType.PARTICULIER ? null : poleForActivity(a.user.companyActivity) }
        : a.user,
    }));
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

  // --- Achats (Points & Boutique) : vue unifiée et filtrable pour le dashboard admin ---

  async getAllPurchases(filters?: {
    wilaya?: string;
    commune?: string;
    search?: string;
    accountType?: 'ALL' | 'PARTICULIER' | 'SOCIETE';
    source?: 'ALL' | 'POINTS' | 'BOUTIQUE';
    status?: string;
  }) {
    const townIds = await this.resolveTownIds(filters?.wilaya, filters?.commune);
    const search = filters?.search?.trim();
    const accountType = filters?.accountType || 'ALL';
    const source = filters?.source || 'ALL';
    const status = filters?.status && filters.status !== 'ALL' ? filters.status : undefined;

    const userWhere = {
      ...(townIds ? { townId: { in: townIds } } : {}),
      ...(accountType === 'PARTICULIER' ? { userType: UserType.PARTICULIER } : {}),
      ...(accountType === 'SOCIETE' ? { userType: UserType.SOCIETE } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { companyName: { contains: search } },
            ],
          }
        : {}),
    };

    const userSelect = {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      companyName: true,
      userType: true,
      townId: true,
    } as const;

    const [pointPurchases, boutiqueSubs] = await Promise.all([
      source === 'BOUTIQUE'
        ? Promise.resolve([])
        : this.prisma.pointPurchase.findMany({
            where: { ...(status ? { status } : {}), user: userWhere },
            include: { user: { select: userSelect } },
            orderBy: { createdAt: 'desc' },
          }),
      source === 'POINTS'
        ? Promise.resolve([])
        : this.prisma.boutiqueSubscription.findMany({
            where: { ...(status ? { status } : {}), user: userWhere },
            include: { user: { select: userSelect } },
            orderBy: { createdAt: 'desc' },
          }),
    ]);

    const merged = [
      ...pointPurchases.map((p) => ({ ...p, source: 'POINTS' as const, expiresAt: null as Date | null })),
      ...boutiqueSubs.map((s) => ({ ...s, source: 'BOUTIQUE' as const, points: s.pointsIncluded })),
    ];

    // Résolution des localisations (townId -> wilaya/commune) en un seul aller-retour
    const townIdsToResolve = [...new Set(merged.map((m) => m.user?.townId).filter((id): id is number => !!id))];
    const towns = townIdsToResolve.length
      ? await this.prisma.town.findMany({ where: { id: { in: townIdsToResolve } }, include: { city: true } })
      : [];
    const townMap = new Map(towns.map((t) => [t.id, t]));

    return merged
      .map((m) => {
        const town = m.user?.townId ? townMap.get(m.user.townId) : undefined;
        return {
          ...m,
          user: m.user ? { ...m.user, location: town ? `${town.nameFr} (${town.city.nameFr})` : null } : m.user,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // --- KPI Points & Boutique : vue analytique (achats + dépenses) pour cibler les actions commerciales.
  // Deux volets distincts, car ils ne portent pas sur les mêmes données :
  //  - Achats  = PointPurchase/BoutiqueSubscription (VALIDATED) : qui achète des points/packs, où, combien.
  //  - Dépenses = PointUsage (points dépensés pour booster/mettre en avant une annonce) : reliée à
  //    l'annonce boostée, donc à son type (Location vs Vente) — ce qui permet de savoir si les points
  //    achetés servent surtout à pousser des locations ou des ventes, par wilaya/commune.
  async getPointsKpi(filters?: {
    wilaya?: string;
    commune?: string;
    accountType?: 'ALL' | 'PARTICULIER' | 'SOCIETE';
    source?: 'ALL' | 'POINTS' | 'BOUTIQUE'; // ne s'applique qu'aux achats
    pack?: string; // clé OfferPack.key ; ne s'applique qu'aux achats
    transactionType?: 'ALL' | 'LOCATION' | 'VENTE'; // ne s'applique qu'aux dépenses
  }) {
    const townIds = await this.resolveTownIds(filters?.wilaya, filters?.commune);
    const accountType = filters?.accountType || 'ALL';
    const source = filters?.source || 'ALL';
    const pack = filters?.pack && filters.pack !== 'ALL' ? filters.pack : undefined;
    const transactionType = filters?.transactionType || 'ALL';

    const userWhere = {
      ...(townIds ? { townId: { in: townIds } } : {}),
      ...(accountType === 'PARTICULIER' ? { userType: UserType.PARTICULIER } : {}),
      ...(accountType === 'SOCIETE' ? { userType: UserType.SOCIETE } : {}),
    };
    const userSelect = { id: true, userType: true, townId: true } as const;

    // --- Achats : uniquement les achats validés (chiffre d'affaires réel, pas les demandes en attente/rejetées) ---
    const [pointPurchases, boutiqueSubs] = await Promise.all([
      source === 'BOUTIQUE'
        ? Promise.resolve([])
        : this.prisma.pointPurchase.findMany({
            where: { status: 'VALIDATED', user: userWhere, ...(pack ? { pack } : {}) },
            select: { points: true, price: true, user: { select: userSelect } },
          }),
      source === 'POINTS'
        ? Promise.resolve([])
        : this.prisma.boutiqueSubscription.findMany({
            where: { status: 'VALIDATED', user: userWhere, ...(pack ? { pack } : {}) },
            select: { pointsIncluded: true, price: true, user: { select: userSelect } },
          }),
    ]);

    const purchases = [
      ...pointPurchases.map((p) => ({ points: p.points, price: p.price, townId: p.user?.townId ?? null })),
      ...boutiqueSubs.map((s) => ({ points: s.pointsIncluded, price: s.price, townId: s.user?.townId ?? null })),
    ];

    // --- Dépenses : PointUsage relié à l'annonce boostée (pour son type Location/Vente) ---
    const announceTypeWhere =
      transactionType === 'LOCATION'
        ? { type: { in: [TransactionType.RENTAL, TransactionType.HOLIDAY_RENTAL] } }
        : transactionType === 'VENTE'
        ? { type: TransactionType.SALE }
        : undefined;

    const usages = await this.prisma.pointUsage.findMany({
      where: {
        user: userWhere,
        ...(announceTypeWhere ? { announce: announceTypeWhere } : {}),
      },
      select: {
        pointsUsed: true,
        user: { select: userSelect },
        announce: { select: { type: true } },
      },
    });

    // --- Résolution géographique groupée (achats + dépenses en un seul aller-retour) ---
    const allTownIds = [
      ...new Set(
        [...purchases.map((p) => p.townId), ...usages.map((u) => u.user?.townId ?? null)].filter(
          (id): id is number => !!id,
        ),
      ),
    ];
    const towns = allTownIds.length
      ? await this.prisma.town.findMany({ where: { id: { in: allTownIds } }, include: { city: true } })
      : [];
    const townMap = new Map(towns.map((t) => [t.id, t]));

    type GeoAgg = { id: number; name: string; count: number; points: number; revenue?: number };
    const wilayaOf = (townId: number | null) => {
      if (!townId) return null;
      const town = townMap.get(townId);
      return town ? { id: town.city.id, name: town.city.nameFr } : null;
    };
    const communeOf = (townId: number | null) => {
      if (!townId) return null;
      const town = townMap.get(townId);
      return town ? { id: town.id, name: town.nameFr } : null;
    };
    const bump = (map: Map<number, GeoAgg>, geo: { id: number; name: string } | null, points: number, revenue?: number) => {
      if (!geo) return;
      const cur = map.get(geo.id) || { id: geo.id, name: geo.name, count: 0, points: 0, ...(revenue !== undefined ? { revenue: 0 } : {}) };
      cur.count++;
      cur.points += points;
      if (revenue !== undefined) cur.revenue = (cur.revenue || 0) + revenue;
      map.set(geo.id, cur);
    };

    // Achats : totaux + répartition géographique
    const purchTotals = { count: purchases.length, points: 0, revenue: 0 };
    const purchByWilaya = new Map<number, GeoAgg>();
    const purchByCommune = new Map<number, GeoAgg>();
    for (const p of purchases) {
      purchTotals.points += p.points;
      purchTotals.revenue += p.price;
      bump(purchByWilaya, wilayaOf(p.townId), p.points, p.price);
      bump(purchByCommune, communeOf(p.townId), p.points, p.price);
    }

    // Dépenses : totaux + répartition Location/Vente + répartition géographique
    const usageTotals = { count: usages.length, points: 0 };
    const usageByType: Record<'LOCATION' | 'VENTE' | 'NON_CLASSE', { count: number; points: number }> = {
      LOCATION: { count: 0, points: 0 },
      VENTE: { count: 0, points: 0 },
      NON_CLASSE: { count: 0, points: 0 },
    };
    const usageByWilaya = new Map<number, GeoAgg>();
    const usageByCommune = new Map<number, GeoAgg>();
    for (const u of usages) {
      usageTotals.points += u.pointsUsed;
      const t = u.announce?.type;
      const cat: 'LOCATION' | 'VENTE' | 'NON_CLASSE' =
        t === TransactionType.SALE ? 'VENTE' : t === TransactionType.RENTAL || t === TransactionType.HOLIDAY_RENTAL ? 'LOCATION' : 'NON_CLASSE';
      usageByType[cat].count++;
      usageByType[cat].points += u.pointsUsed;

      const townId = u.user?.townId ?? null;
      bump(usageByWilaya, wilayaOf(townId), u.pointsUsed);
      bump(usageByCommune, communeOf(townId), u.pointsUsed);
    }

    const byPoints = (arr: GeoAgg[]) => arr.sort((a, b) => b.points - a.points);

    return {
      purchases: {
        ...purchTotals,
        byWilaya: byPoints([...purchByWilaya.values()]),
        byCommune: byPoints([...purchByCommune.values()]).slice(0, 25),
      },
      usage: {
        ...usageTotals,
        byType: usageByType,
        byWilaya: byPoints([...usageByWilaya.values()]),
        byCommune: byPoints([...usageByCommune.values()]).slice(0, 25),
      },
    };
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
