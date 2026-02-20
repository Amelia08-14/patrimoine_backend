import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEntrustedResearchDto } from './dto/create-entrusted-research.dto';

@Injectable()
export class EntrustedResearchService {
  constructor(private prisma: PrismaService) {}

  create(createDto: CreateEntrustedResearchDto) {
    return this.prisma.entrustedResearch.create({
      data: {
        ...createDto,
        installationDate: new Date(createDto.installationDate),
      },
    });
  }

  findAll() {
    return this.prisma.entrustedResearch.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
