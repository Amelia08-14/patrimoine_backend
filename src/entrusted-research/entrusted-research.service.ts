import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEntrustedResearchDto } from './dto/create-entrusted-research.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class EntrustedResearchService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async create(createDto: CreateEntrustedResearchDto) {
    const research = await this.prisma.entrustedResearch.create({
      data: {
        ...createDto,
        installationDate: new Date(createDto.installationDate),
      },
    });

    // Notifie les propriétaires d'annonces validées qui correspondent (même transaction, et même
    // wilaya si précisée) — best-effort, ne doit jamais faire échouer la création de la recherche.
    // Simplification assumée : le rapprochement se fait sur transaction + ville, pas sur la
    // catégorie précise de bien (qui demanderait de dupliquer côté back le mapping
    // propertyType -> catégorie qui n'existe aujourd'hui que côté front, dans propertyTypes.ts).
    try {
      const candidates = await this.prisma.announce.findMany({
        where: {
          status: 'VALIDATED',
          type: research.transaction,
          userId: research.userId ? { not: research.userId } : undefined,
          ...(research.cityId
            ? { property: { address: { town: { cityId: research.cityId } } } }
            : {}),
        },
        select: { userId: true },
        distinct: ['userId'],
        take: 25,
      });

      for (const c of candidates) {
        await this.notificationService.create(
          c.userId,
          'RESEARCH_MATCH',
          'Une nouvelle recherche confiée correspond à vos annonces',
          research.comment?.slice(0, 140),
          '/demandes',
        );
      }
    } catch (e) {
      // Silencieux — ne bloque jamais la création de la recherche.
    }

    return research;
  }

  async findAll(userId?: number) {
    const researches = await this.prisma.entrustedResearch.findMany({
      where: userId ? { userId } : undefined,
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
