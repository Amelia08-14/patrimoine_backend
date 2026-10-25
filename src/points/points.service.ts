import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { OfferPackKind } from '@prisma/client';
import { assertAccountVerified } from '../users/account-verification';
import { assertNoPendingOrder } from './pending-order';

@Injectable()
export class PointsService {
  constructor(private prisma: PrismaService, private notificationService: NotificationService) {}

  async getBalance(userId: number) {
    let up = await this.prisma.userPoint.findUnique({ where: { userId } });
    if (!up) up = await this.prisma.userPoint.create({ data: { userId, currentPoints: 0 } });

    // Si les points ont expiré, on les remet à 0
    if (up.expirationDate && new Date() > new Date(up.expirationDate) && up.currentPoints > 0) {
      await this.prisma.userPoint.update({ where: { userId }, data: { currentPoints: 0 } });
      return { points: 0, expirationDate: up.expirationDate, expired: true };
    }

    return { points: up.currentPoints, expirationDate: up.expirationDate, expired: false };
  }

  async purchasePack(userId: number, pack: string, paymentMethod?: string, receiptUrl?: string) {
    const packDef = await this.prisma.offerPack.findUnique({ where: { kind_key: { kind: OfferPackKind.POINTS, key: pack } } });
    if (!packDef) throw new BadRequestException('Pack invalide');
    await assertNoPendingOrder(this.prisma, userId);
    return this.prisma.pointPurchase.create({
      data: { userId, pack, points: packDef.points, price: packDef.price, status: 'PENDING', paymentMethod, receiptUrl }
    });
  }

  // Ajouter/remplacer le reçu d'un achat PENDING appartenant à l'utilisateur — ne touche jamais un
  // achat déjà validé/rejeté (son dossier est clos) ni celui d'un autre utilisateur.
  async setReceipt(userId: number, purchaseId: number, receiptUrl?: string) {
    if (!receiptUrl) throw new BadRequestException('Aucun fichier reçu');
    const purchase = await this.prisma.pointPurchase.findFirst({ where: { id: purchaseId, userId } });
    if (!purchase) throw new NotFoundException('Achat introuvable');
    if (purchase.status !== 'PENDING') throw new BadRequestException('Cet achat a déjà été traité');
    return this.prisma.pointPurchase.update({ where: { id: purchaseId }, data: { receiptUrl } });
  }

  async getUserPurchases(userId: number) {
    return this.prisma.pointPurchase.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getUserHistory(userId: number, from?: string, to?: string) {
    const usageDate: { gte?: Date; lte?: Date } = {};
    if (from) usageDate.gte = new Date(from);
    if (to) usageDate.lte = new Date(`${to}T23:59:59`);

    return this.prisma.pointUsage.findMany({
      where: { userId, ...(from || to ? { usageDate } : {}) },
      include: {
        announce: { select: { id: true, reference: true, title: true } },
        research: { select: { id: true, realEstateType: true, propertyType: true } },
      },
      orderBy: { usageDate: 'desc' },
      take: from || to ? undefined : 50,
    });
  }

  // Notifie dès qu'une dépense amène le solde à 0 — "fin de points" au sens où le client
  // l'entend le plus naturellement (épuisés par l'usage), distincte de l'expiration par date déjà
  // gérée par checkExpiringPoints() (retour client du 17/10/2026 : "message fin de point
  // automatique non fait"). best-effort : ne doit jamais faire échouer la dépense elle-même.
  private async notifyIfDepleted(userId: number, balanceBefore: number, spent: number) {
    if (balanceBefore - spent !== 0) return;
    try {
      await this.notificationService.create(
        userId,
        'POINTS_EXPIRED',
        'Votre solde de points est épuisé',
        'Vous avez utilisé tous vos points. Rachetez un pack pour continuer à actualiser ou mettre en avant vos annonces.',
        '/profile/points',
      );
    } catch { /* best-effort */ }
  }

  // Délai minimal entre deux actualisations d'une même annonce/recherche (demande client du
  // 25/10/2026). Calculé sur la dernière actualisation réellement payée (PointUsage), pas sur
  // refreshDate, qui peut aussi bouger pour d'autres raisons (validation admin...).
  static readonly REFRESH_COOLDOWN_MINUTES = 45;

  private async assertRefreshCooldown(where: { announceId: number; action: 'BOOST' } | { researchId: number; action: 'BOOST_RESEARCH' }) {
    const last = await this.prisma.pointUsage.findFirst({ where, orderBy: { usageDate: 'desc' }, select: { usageDate: true } });
    if (!last) return;
    const cooldownMs = PointsService.REFRESH_COOLDOWN_MINUTES * 60 * 1000;
    const remainingMs = new Date(last.usageDate).getTime() + cooldownMs - Date.now();
    if (remainingMs > 0) {
      const minutes = Math.ceil(remainingMs / 60000);
      throw new BadRequestException({
        statusCode: 400,
        code: 'REFRESH_COOLDOWN',
        remainingMinutes: minutes,
        message: `Vous avez déjà actualisé récemment. Prochaine actualisation possible dans ${minutes} min (une actualisation toutes les ${PointsService.REFRESH_COOLDOWN_MINUTES} min).`,
      });
    }
  }

  // 1 point → actualiser (refreshDate = now, remonte dans la catégorie)
  async boostAnnounce(userId: number, announceId: number) {
    await assertAccountVerified(this.prisma, userId);
    const announce = await this.prisma.announce.findFirst({ where: { id: announceId, userId } });
    if (!announce) throw new NotFoundException('Annonce introuvable');
    await this.assertRefreshCooldown({ announceId, action: 'BOOST' });

    const balance = await this.getBalance(userId);
    if (balance.points < 1) throw new BadRequestException('Solde de points insuffisant (1 point requis)');

    await this.prisma.$transaction([
      this.prisma.announce.update({ where: { id: announceId }, data: { refreshDate: new Date() } }),
      this.prisma.userPoint.update({ where: { userId }, data: { currentPoints: { decrement: 1 } } }),
      this.prisma.pointUsage.create({ data: { userId, announceId, pointsUsed: 1, action: 'BOOST' } })
    ]);
    await this.notifyIfDepleted(userId, balance.points, 1);
    return { success: true, message: 'Annonce actualisée avec succès' };
  }

  // 1 point → actualiser une recherche confiée (refreshDate = now, remonte en tête de /demandes)
  async boostResearch(userId: number, researchId: number) {
    await assertAccountVerified(this.prisma, userId);
    const research = await this.prisma.entrustedResearch.findFirst({ where: { id: researchId, userId } });
    if (!research) throw new NotFoundException('Recherche introuvable');
    await this.assertRefreshCooldown({ researchId, action: 'BOOST_RESEARCH' });

    const balance = await this.getBalance(userId);
    if (balance.points < 1) throw new BadRequestException('Solde de points insuffisant (1 point requis)');

    await this.prisma.$transaction([
      this.prisma.entrustedResearch.update({ where: { id: researchId }, data: { refreshDate: new Date() } }),
      this.prisma.userPoint.update({ where: { userId }, data: { currentPoints: { decrement: 1 } } }),
      this.prisma.pointUsage.create({ data: { userId, researchId, pointsUsed: 1, action: 'BOOST_RESEARCH' } }),
    ]);
    await this.notifyIfDepleted(userId, balance.points, 1);
    return { success: true, message: 'Recherche actualisée avec succès' };
  }

  // N jours × 2 points → mettre en publicité sur la page d'accueil
  async featureAnnounce(userId: number, announceId: number, days: number, startDate: Date) {
    await assertAccountVerified(this.prisma, userId);
    if (days < 1 || days > 30) throw new BadRequestException('Durée invalide (1-30 jours)');
    const cost = days * 2;
    const announce = await this.prisma.announce.findFirst({ where: { id: announceId, userId } });
    if (!announce) throw new NotFoundException('Annonce introuvable');

    const balance = await this.getBalance(userId);
    if (balance.points < cost) throw new BadRequestException(`Solde insuffisant (${cost} points requis)`);

    const featuredFrom = new Date(startDate);
    const featuredUntil = new Date(featuredFrom);
    featuredUntil.setDate(featuredUntil.getDate() + days);

    await this.prisma.$transaction([
      this.prisma.announce.update({ where: { id: announceId }, data: { featuredFrom, featuredUntil } }),
      this.prisma.userPoint.update({ where: { userId }, data: { currentPoints: { decrement: cost } } }),
      this.prisma.pointUsage.create({ data: { userId, announceId, pointsUsed: cost, action: 'FEATURE' } })
    ]);
    await this.notifyIfDepleted(userId, balance.points, cost);
    return { success: true, cost, featuredFrom, featuredUntil };
  }

  // ── ADMIN ──

  async getAllPurchases(status?: string) {
    return this.prisma.pointPurchase.findMany({
      where: status ? { status } : {},
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, companyName: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async validatePurchase(purchaseId: number) {
    const purchase = await this.prisma.pointPurchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) throw new NotFoundException('Achat introuvable');
    if (purchase.status !== 'PENDING') throw new BadRequestException('Cet achat a déjà été traité');

    // Valables 1 mois à compter de la validation (promis dans l'UI d'achat) — sans ce reset,
    // un nouvel achat validé après l'expiration d'un ancien abonnement boutique (qui, lui,
    // pose sa propre expirationDate sur le même compteur de points) se faisait effacer au
    // prochain calcul de solde : la date d'expiration restait bloquée dans le passé alors que
    // les points venaient d'être crédités.
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await this.prisma.$transaction([
      this.prisma.pointPurchase.update({ where: { id: purchaseId }, data: { status: 'VALIDATED', validatedAt: now } }),
      this.prisma.userPoint.upsert({
        where: { userId: purchase.userId },
        create: { userId: purchase.userId, currentPoints: purchase.points, expirationDate: expiresAt },
        update: { currentPoints: { increment: purchase.points }, expirationDate: expiresAt }
      })
    ]);
    return { success: true };
  }

  async rejectPurchase(purchaseId: number) {
    const purchase = await this.prisma.pointPurchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) throw new NotFoundException('Achat introuvable');
    if (purchase.status !== 'PENDING') throw new BadRequestException('Déjà traité');
    await this.prisma.pointPurchase.update({ where: { id: purchaseId }, data: { status: 'REJECTED' } });
    return { success: true };
  }

  // Alerte "points bientôt expirés" (J-3) + notification + remise à zéro effective dès
  // l'expiration réelle, plutôt que d'attendre que l'utilisateur revienne consulter son solde
  // (la vérification paresseuse de getBalance() reste en place en complément) — demande client
  // du 15/10/2026. Tourne une fois par jour ; le calcul en jours entiers restants garantit que
  // chaque utilisateur ne reçoit l'alerte "J-3" qu'une seule fois (le compte à rebours ne vaut
  // exactement 3 qu'un seul jour calendaire, en supposant que le cron ne manque pas un jour).
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkExpiringPoints() {
    const now = new Date();
    const withPoints = await this.prisma.userPoint.findMany({
      where: { currentPoints: { gt: 0 }, expirationDate: { not: null } },
    });

    for (const up of withPoints) {
      if (!up.expirationDate) continue;
      const daysRemaining = Math.ceil((up.expirationDate.getTime() - now.getTime()) / 86400000);

      if (up.expirationDate < now) {
        // Déjà expiré : on remet à 0 proactivement (sans attendre un prochain getBalance()) et
        // on notifie — "même quand ils se terminent il aura une notification".
        await this.prisma.userPoint.update({ where: { userId: up.userId }, data: { currentPoints: 0 } });
        try {
          await this.notificationService.create(
            up.userId,
            'POINTS_EXPIRED',
            'Vos points ont expiré',
            `Vos ${up.currentPoints} points restants ont expiré et ont été remis à zéro.`,
            '/profile/points',
          );
        } catch { /* la notification ne doit jamais bloquer la remise à zéro */ }
      } else if (daysRemaining === 3) {
        try {
          await this.notificationService.create(
            up.userId,
            'POINTS_EXPIRING',
            'Vos points expirent bientôt',
            `Il vous reste ${up.currentPoints} points, valables encore 3 jours. Pensez à les utiliser ou à en racheter.`,
            '/profile/points',
          );
        } catch { /* best-effort */ }
      }
    }
  }
}
