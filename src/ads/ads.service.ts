import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AdInput = {
  name?: string; imageUrl?: string; link?: string | null;
  title?: string | null; titleAr?: string | null; titleEn?: string | null;
  subtitle?: string | null; subtitleAr?: string | null; subtitleEn?: string | null;
  buttonLabel?: string | null; buttonLabelAr?: string | null; buttonLabelEn?: string | null;
  placements?: string; pages?: string; categories?: string; isActive?: boolean;
  startDate?: Date | null; endDate?: Date | null; order?: number;
};

@Injectable()
export class AdsService {
  constructor(private readonly prisma: PrismaService) {}

  // Publicités visibles maintenant (actives, dans leur période), filtrables par page et emplacement.
  async getPublic(page?: string, placement?: string) {
    const now = new Date();
    const rows = await this.prisma.advertisement.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
      orderBy: [{ order: 'asc' }, { id: 'desc' }],
    });
    const has = (csv: string, v?: string) => !v || csv.split(',').map((x) => x.trim()).includes(v.toUpperCase());
    return rows.filter((r) => has(r.pages, page) && has(r.placements, placement));
  }

  async trackView(id: number) {
    await this.prisma.advertisement.updateMany({ where: { id }, data: { views: { increment: 1 } } });
    return { ok: true };
  }

  async trackClick(id: number) {
    await this.prisma.advertisement.updateMany({ where: { id }, data: { clicks: { increment: 1 } } });
    return { ok: true };
  }

  getAll() {
    return this.prisma.advertisement.findMany({ orderBy: [{ order: 'asc' }, { id: 'desc' }] });
  }

  create(data: AdInput & { name: string; imageUrl: string }) {
    return this.prisma.advertisement.create({ data });
  }

  async update(id: number, data: AdInput) {
    const item = await this.prisma.advertisement.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Publicité introuvable');
    return this.prisma.advertisement.update({ where: { id }, data });
  }

  async remove(id: number) {
    const item = await this.prisma.advertisement.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Publicité introuvable');
    return this.prisma.advertisement.delete({ where: { id } });
  }
}
