import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

  // Champs personnels du demandeur : jamais exposés par les routes publiques (liste /demandes, fiche).
  private stripPii<T extends Record<string, any>>(r: T) {
    const { email, phone, address, lastName, ...safe } = r as any;
    return safe;
  }

  async count() {
    return { count: await this.prisma.entrustedResearch.count() };
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
    const enriched = await this.enrich(researches);
    // Liste publique : sans coordonnées personnelles. Le demandeur voit tout dans « mes recherches ».
    return userId ? enriched : enriched.map((r) => this.stripPii(r));
  }

  async findOnePublic(id: number) {
    const research = await this.prisma.entrustedResearch.findUnique({
      where: { id },
      include: { user: { select: { id: true, firstName: true, lastName: true, companyName: true } } },
    });
    if (!research) throw new NotFoundException('Demande introuvable');
    const [enriched] = await this.enrich([research]);
    return { ...this.stripPii(enriched), ownerId: research.userId };
  }

  // Adresse e-mail du demandeur, réservée aux utilisateurs connectés (action « Envoyer un mail »).
  async getContactEmail(id: number) {
    const r = await this.prisma.entrustedResearch.findUnique({
      where: { id },
      select: { email: true, user: { select: { email: true } } },
    });
    if (!r) throw new NotFoundException('Demande introuvable');
    return { email: r.email || r.user?.email || null };
  }

  // « Demander le contact » : prévient le demandeur par message + notification, sans révéler ses coordonnées.
  async requestContact(senderId: number, id: number) {
    const r = await this.prisma.entrustedResearch.findUnique({ where: { id }, select: { userId: true } });
    if (!r) throw new NotFoundException('Demande introuvable');
    if (!r.userId) throw new BadRequestException("Le demandeur n'a pas de compte : contactez-le par mail");
    if (r.userId === senderId) throw new BadRequestException('Ceci est votre propre demande');
    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { firstName: true, lastName: true, companyName: true, phone: true },
    });
    const who = sender?.companyName || [sender?.firstName, sender?.lastName].filter(Boolean).join(' ') || 'Un utilisateur';
    const content = `${who} souhaite obtenir vos coordonnées au sujet de votre recherche n°${id}.${sender?.phone ? ` Vous pouvez le joindre au ${sender.phone}.` : ''}`;
    await this.prisma.message.create({ data: { senderId, receiverId: r.userId, content } });
    try {
      await this.notificationService.create(r.userId, 'MESSAGE', 'Demande de contact pour votre recherche', content.slice(0, 140), '/profile/messages');
    } catch {}
    return { success: true };
  }

  private async enrich(researches: any[]) {
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
        const ids = [...new Set(parsed.map((id) => Number(id)).filter((id) => !isNaN(id)))];
        townIdsByResearch.set(r.id, ids);
        ids.forEach((id) => allTownIds.add(id));
      } catch {}
    }
    const towns = allTownIds.size
      ? await this.prisma.town.findMany({ where: { id: { in: [...allTownIds] } } })
      : [];
    const townMap = new Map(towns.map((t) => [t.id, t.nameFr]));

    // Tri par dernière activité : une recherche actualisée avec des points remonte en tête.
    const activity = (r: { refreshDate: Date | null; createdAt: Date }) => (r.refreshDate ?? r.createdAt).getTime();
    researches.sort((a, b) => activity(b) - activity(a));

    return researches.map((r) => ({
      ...r,
      lastActivityAt: r.refreshDate ?? r.createdAt,
      cityName: r.cityId ? cityMap.get(r.cityId) || null : null,
      townNames: (townIdsByResearch.get(r.id) || []).map((id) => townMap.get(id)).filter(Boolean),
    }));
  }
}
