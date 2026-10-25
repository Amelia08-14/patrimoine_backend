import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class MessageService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async sendMessage(senderId: number, receiverId: number, announceId: number | null, content: string) {
    content = String(content ?? '').slice(0, 5000); // limite de 5000 caractères
    const message = await this.prisma.message.create({
      data: {
        senderId,
        receiverId,
        announceId,
        content,
      },
    });

    // Notifie le destinataire — best-effort : un échec ici ne doit jamais faire échouer l'envoi
    // du message lui-même.
    try {
      const sender = await this.prisma.user.findUnique({
        where: { id: senderId },
        select: { firstName: true, lastName: true, companyName: true, userType: true },
      });
      const senderName = sender?.userType === 'ADMIN'
        ? 'Patrimoine-Immobilier'
        : sender?.companyName || [sender?.firstName, sender?.lastName].filter(Boolean).join(' ') || 'Un utilisateur';
      await this.notificationService.create(
        receiverId,
        'MESSAGE',
        `Nouveau message de ${senderName}`,
        content.length > 120 ? `${content.slice(0, 120)}…` : content,
        '/profile/messages',
      );
    } catch (e) {
      // Silencieux — ne bloque jamais l'envoi du message.
    }

    return message;
  }

  async markConversationRead(userId: number, partnerId: number) {
    const res = await this.prisma.message.updateMany({
      where: { senderId: partnerId, receiverId: userId, isRead: false },
      data: { isRead: true },
    });
    return { updated: res.count };
  }

  async getMyMessages(userId: number) {
    // Basic inbox logic: get all messages where I am receiver or sender
    return this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
      include: {
        // userType : un message de l'administration (ex. au sujet d'une commande, envoyé depuis
        // /admin/points) s'affiche côté client sous le nom "Patrimoine-Immobilier", pas "Admin System".
        sender: { select: { id: true, firstName: true, lastName: true, companyName: true, imageUrl: true, userType: true } },
        receiver: { select: { id: true, firstName: true, lastName: true, companyName: true, imageUrl: true, userType: true } },
        announce: { select: { id: true, reference: true, property: { select: { propertyType: true, area: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
