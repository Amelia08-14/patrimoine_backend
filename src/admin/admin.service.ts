import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AnnounceStatus, UserType, AccountStatus } from '@prisma/client';

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
  adminVerified: true,
  accountStatus: true,
  statusReason: true,
} as const;

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
