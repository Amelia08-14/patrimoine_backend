import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OfferPackKind, ContactChannel } from '@prisma/client';

@Injectable()
export class BoutiqueSubService {
  constructor(private prisma: PrismaService) {}

  // Utilisateur achète un pack boutique
  async purchasePack(userId: number, pack: string) {
    const def = await this.prisma.offerPack.findUnique({ where: { kind_key: { kind: OfferPackKind.BOUTIQUE, key: pack } } });
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

  // ── Abonnés à la boutique publique (bouton "S'abonner") ──
  // Compteur réel, réutilisé dans les statistiques du pro.

  async followBoutique(followerId: number, ownerId: number) {
    if (followerId === ownerId) throw new BadRequestException('Impossible de vous abonner à votre propre boutique');
    await this.prisma.boutiqueFollow.upsert({
      where: { followerId_ownerId: { followerId, ownerId } },
      create: { followerId, ownerId },
      update: {},
    });
    const count = await this.prisma.boutiqueFollow.count({ where: { ownerId } });
    return { following: true, count };
  }

  async unfollowBoutique(followerId: number, ownerId: number) {
    await this.prisma.boutiqueFollow.deleteMany({ where: { followerId, ownerId } });
    const count = await this.prisma.boutiqueFollow.count({ where: { ownerId } });
    return { following: false, count };
  }

  // Public : nombre d'abonnés d'une boutique, et si `followerId` la suit déjà (facultatif).
  async getBoutiqueFollowStatus(ownerId: number, followerId?: number) {
    const [count, isFollowing] = await Promise.all([
      this.prisma.boutiqueFollow.count({ where: { ownerId } }),
      followerId
        ? this.prisma.boutiqueFollow.findUnique({ where: { followerId_ownerId: { followerId, ownerId } } })
        : Promise.resolve(null),
    ]);
    return { count, following: !!isFollowing };
  }

  // Pour les statistiques du pro : la liste de ses abonnés.
  async getBoutiqueFollowers(ownerId: number) {
    return this.prisma.boutiqueFollow.findMany({
      where: { ownerId },
      include: { follower: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Clic sur un moyen de contact affiché directement sur la boutique (pas lié à une annonce
  // précise) — repris dans "Mes statistiques" comme "Contacts via boutique".
  async trackBoutiqueContact(ownerId: number, channel: string) {
    const validChannels = Object.values(ContactChannel);
    if (!validChannels.includes(channel as ContactChannel)) {
      throw new BadRequestException('Canal de contact invalide');
    }
    const click = await this.prisma.contactClick.create({
      data: { ownerId, channel: channel as ContactChannel, announceId: null },
    });
    return { success: true, id: click.id };
  }
}
