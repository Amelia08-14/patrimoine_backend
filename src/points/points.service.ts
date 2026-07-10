import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PACKS = {
  PACK_50:  { points: 50,  price: 1500 },
  PACK_100: { points: 100, price: 2500 },
  PACK_200: { points: 200, price: 3500 },
};

@Injectable()
export class PointsService {
  constructor(private prisma: PrismaService) {}

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

  async purchasePack(userId: number, pack: string) {
    const packDef = PACKS[pack as keyof typeof PACKS];
    if (!packDef) throw new BadRequestException('Pack invalide');
    return this.prisma.pointPurchase.create({
      data: { userId, pack, points: packDef.points, price: packDef.price, status: 'PENDING' }
    });
  }

  async getUserPurchases(userId: number) {
    return this.prisma.pointPurchase.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getUserHistory(userId: number) {
    return this.prisma.pointUsage.findMany({
      where: { userId },
      include: { announce: { select: { id: true, reference: true, title: true } } },
      orderBy: { usageDate: 'desc' },
      take: 50
    });
  }

  // 1 point → actualiser (refreshDate = now, remonte dans la catégorie)
  async boostAnnounce(userId: number, announceId: number) {
    const announce = await this.prisma.announce.findFirst({ where: { id: announceId, userId } });
    if (!announce) throw new NotFoundException('Annonce introuvable');

    const balance = await this.getBalance(userId);
    if (balance.points < 1) throw new BadRequestException('Solde de points insuffisant (1 point requis)');

    await this.prisma.$transaction([
      this.prisma.announce.update({ where: { id: announceId }, data: { refreshDate: new Date() } }),
      this.prisma.userPoint.update({ where: { userId }, data: { currentPoints: { decrement: 1 } } }),
      this.prisma.pointUsage.create({ data: { userId, announceId, pointsUsed: 1, action: 'BOOST' } })
    ]);
    return { success: true, message: 'Annonce actualisée avec succès' };
  }

  // N jours × 2 points → mettre en publicité sur la page d'accueil
  async featureAnnounce(userId: number, announceId: number, days: number, startDate: Date) {
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

    await this.prisma.$transaction([
      this.prisma.pointPurchase.update({ where: { id: purchaseId }, data: { status: 'VALIDATED', validatedAt: new Date() } }),
      this.prisma.userPoint.upsert({
        where: { userId: purchase.userId },
        create: { userId: purchase.userId, currentPoints: purchase.points },
        update: { currentPoints: { increment: purchase.points } }
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
}
