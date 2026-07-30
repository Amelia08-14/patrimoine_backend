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

  async findAll() {
    const researches = await this.prisma.entrustedResearch.findMany({
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, companyName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const cityIds = [...new Set(researches.map((r) => r.cityId).filter((id): id is number => !!id))];
    const cities = cityIds.length
      ? await this.prisma.city.findMany({ where: { id: { in: cityIds } } })
      : [];
    const cityMap = new Map(cities.map((c) => [c.id, c.nameFr]));

    const townIdsByResearch = new Map<number, number[]>();
    const allTownIds = new Set<number>();
    for (const r of researches) {
      if (!r.towns) continue;
      try {
        const parsed: unknown[] = JSON.parse(r.towns);
        const ids = parsed.map((id) => Number(id)).filter((id) => !isNaN(id));
        townIdsByResearch.set(r.id, ids);
        ids.forEach((id) => allTownIds.add(id));
      } catch {}
    }
    const towns = allTownIds.size
      ? await this.prisma.town.findMany({ where: { id: { in: [...allTownIds] } } })
      : [];
    const townMap = new Map(towns.map((t) => [t.id, t.nameFr]));

    return researches.map((r) => ({
      ...r,
      cityName: r.cityId ? cityMap.get(r.cityId) || null : null,
      townNames: (townIdsByResearch.get(r.id) || []).map((id) => townMap.get(id)).filter(Boolean),
    }));
  }
}
