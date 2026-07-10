import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const BOUTIQUE_PACKS = {
  STANDARD:   { price: 5000,  points: 50  },
  AVANCEE:    { price: 10000, points: 100 },
  ENTREPRISE: { price: 15000, points: 200 },
};

@Injectable()
export class BoutiqueSubService {
  constructor(private prisma: PrismaService) {}

  // Utilisateur achète un pack boutique
  async purchasePack(userId: number, pack: string) {
    const def = BOUTIQUE_PACKS[pack as keyof typeof BOUTIQUE_PACKS];
    if (!def) throw new BadRequestException('Pack boutique invalide');

    // Bloque si demande PENDING en cours ou abonnement actif non expiré
    const existing = await this.prisma.boutiqueSubscription.findFirst({
      where: { userId, status: { in: ['PENDING', 'VALIDATED'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      if (existing.status === 'PENDING')
        throw new BadRequestException('Vous avez déjà une demande en attente de validation');
      if (existing.expiresAt && existing.expiresAt > new Date())
        throw new BadRequestException('Vous avez déjà un abonnement boutique actif');
    }

    return this.prisma.boutiqueSubscription.create({
      data: { userId, pack, price: def.price, pointsIncluded: def.points, status: 'PENDING' }
    });
  }

  // Abonnement actif = VALIDATED et expiresAt dans le futur
  async getActiveSubscription(userId: number) {
    return this.prisma.boutiqueSubscription.findFirst({
      where: { userId, status: 'VALIDATED', expiresAt: { gt: new Date() } },
      orderBy: { validatedAt: 'desc' }
    });
  }

  // Toutes les souscriptions d'un utilisateur
  async getUserSubscriptions(userId: number) {
    return this.prisma.boutiqueSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Admin: liste toutes les souscriptions
  async getAllSubscriptions(status?: string) {
    return this.prisma.boutiqueSubscription.findMany({
      where: status ? { status } : {},
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, companyName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Admin: valider → active boutique + crédite points (valides 1 mois)
  async validateSubscription(id: number) {
    const sub = await this.prisma.boutiqueSubscription.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Souscription introuvable');
    if (sub.status !== 'PENDING') throw new BadRequestException('Cette souscription a déjà été traitée');

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + 1); // +1 mois

    await this.prisma.$transaction([
      this.prisma.boutiqueSubscription.update({
        where: { id },
        data: { status: 'VALIDATED', validatedAt: now, expiresAt }
      }),
      this.prisma.userPoint.upsert({
        where: { userId: sub.userId },
        create: { userId: sub.userId, currentPoints: sub.pointsIncluded, expirationDate: expiresAt },
        update: { currentPoints: { increment: sub.pointsIncluded }, expirationDate: expiresAt }
      })
    ]);

    return { success: true, pointsCredited: sub.pointsIncluded, expiresAt };
  }

  // Admin: rejeter
  async rejectSubscription(id: number) {
    const sub = await this.prisma.boutiqueSubscription.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Souscription introuvable');
    if (sub.status !== 'PENDING') throw new BadRequestException('Déjà traitée');
    await this.prisma.boutiqueSubscription.update({ where: { id }, data: { status: 'REJECTED' } });
    return { success: true };
  }
}
