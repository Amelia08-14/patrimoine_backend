import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationType =
  | 'MESSAGE'
  | 'RESEARCH_MATCH'
  | 'ANNOUNCE_VALIDATED'
  | 'ANNOUNCE_REJECTED'
  | 'POINTS_EXPIRING';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  // Utilisé par les autres services (message, entrusted-research, admin, points) — pas de route
  // POST publique : une notification n'est créée que par le système lui-même, jamais par un
  // utilisateur directement.
  async create(userId: number, type: NotificationType, title: string, body?: string, link?: string) {
    return this.prisma.notification.create({
      data: { userId, type, title, body, link },
    });
  }

  async findMine(userId: number) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(userId: number) {
    const count = await this.prisma.notification.count({ where: { userId, isRead: false } });
    return { count };
  }

  async markRead(userId: number, id: number) {
    // updateMany plutôt que update : ignore silencieusement si la notif n'appartient pas à
    // l'appelant, au lieu de renvoyer une erreur Prisma "Record not found".
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    return { status: 'ok' };
  }

  async markAllRead(userId: number) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { status: 'ok', updated: res.count };
  }
}
