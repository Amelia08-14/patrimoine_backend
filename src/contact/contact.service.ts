import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';

@Injectable()
export class ContactService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateContactDto & { attachmentUrl?: string }) {
    return this.prisma.contact.create({
      data: {
        ...data,
        motif: data.motif || 'GENERAL',
        status: 'NEW',
      },
    });
  }

  findAll() {
    return this.prisma.contact.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  updateStatus(id: number, status: string) {
    return this.prisma.contact.update({ where: { id }, data: { status } });
  }
}
