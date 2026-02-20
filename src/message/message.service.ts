import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessageService {
  constructor(private prisma: PrismaService) {}

  async sendMessage(senderId: number, receiverId: number, announceId: number | null, content: string) {
    return this.prisma.message.create({
      data: {
        senderId,
        receiverId,
        announceId,
        content,
      },
    });
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
        sender: { select: { id: true, firstName: true, lastName: true, companyName: true, imageUrl: true } },
        receiver: { select: { id: true, firstName: true, lastName: true, companyName: true, imageUrl: true } },
        announce: { select: { id: true, reference: true, property: { select: { description: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
