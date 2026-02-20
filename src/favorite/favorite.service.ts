import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoriteService {
  constructor(private prisma: PrismaService) {}

  async toggleFavorite(userId: number, announceId: number) {
    const existing = await this.prisma.favorite.findUnique({
      where: {
        userId_announceId: {
          userId,
          announceId,
        },
      },
    });

    if (existing) {
      // Remove
      await this.prisma.favorite.delete({
        where: { id: existing.id },
      });
      // Decrement count
      await this.prisma.announce.update({
        where: { id: announceId },
        data: { nbFavs: { decrement: 1 } },
      });
      return { status: 'removed' };
    } else {
      // Add
      await this.prisma.favorite.create({
        data: {
          userId,
          announceId,
        },
      });
      // Increment count
      await this.prisma.announce.update({
        where: { id: announceId },
        data: { nbFavs: { increment: 1 } },
      });
      return { status: 'added' };
    }
  }

  async getMyFavorites(userId: number) {
    return this.prisma.favorite.findMany({
      where: { userId },
      include: {
        announce: {
          include: {
            property: {
              include: {
                images: true,
                address: { include: { town: { include: { city: true } } } }
              }
            },
            user: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
