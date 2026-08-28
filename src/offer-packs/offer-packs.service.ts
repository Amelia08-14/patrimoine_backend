import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OfferPackKind } from '@prisma/client';

@Injectable()
export class OfferPacksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.offerPack.findMany({ orderBy: [{ kind: 'asc' }, { order: 'asc' }] });
  }

  // Utilisé par PointsService/BoutiqueSubService pour connaître le prix/points en vigueur
  // au moment de l'achat (source unique de vérité, éditable par l'admin).
  async findByKindAndKey(kind: OfferPackKind, key: string) {
    return this.prisma.offerPack.findUnique({ where: { kind_key: { kind, key } } });
  }

  async create(data: { kind: OfferPackKind; key: string; title: string; description?: string | null; price: number; points: number }) {
    if (!data.kind || !Object.values(OfferPackKind).includes(data.kind)) {
      throw new BadRequestException('Type d\'offre invalide (POINTS ou BOUTIQUE)');
    }
    if (!data.key?.trim() || !data.title?.trim()) {
      throw new BadRequestException('Identifiant et titre requis');
    }
    // Identifiant technique stable, dérivé du titre si non fourni explicitement : lettres/chiffres
    // majuscules et underscores uniquement (référencé ensuite par les achats de ce pack).
    const key = data.key.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!key) throw new BadRequestException('Identifiant invalide');

    const existing = await this.prisma.offerPack.findUnique({ where: { kind_key: { kind: data.kind, key } } });
    if (existing) throw new ConflictException('Une offre avec cet identifiant existe déjà pour ce type');

    const maxOrder = await this.prisma.offerPack.aggregate({ where: { kind: data.kind }, _max: { order: true } });

    return this.prisma.offerPack.create({
      data: {
        kind: data.kind,
        key,
        title: data.title,
        description: data.description || null,
        price: data.price,
        points: data.points,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });
  }

  async update(id: number, data: { title?: string; description?: string | null; price?: number; points?: number }) {
    const pack = await this.prisma.offerPack.findUnique({ where: { id } });
    if (!pack) throw new NotFoundException('Offre introuvable');

    // Garde-fou : une offre déjà publiée ne doit jamais se retrouver avec un titre vide ou
    // un prix/nombre de points invalide suite à une modification incomplète depuis l'admin.
    if (data.title !== undefined && !data.title.trim()) {
      throw new BadRequestException('Le titre est obligatoire');
    }
    if (data.price !== undefined && (!Number.isFinite(data.price) || data.price < 0)) {
      throw new BadRequestException('Prix invalide');
    }
    if (data.points !== undefined && (!Number.isFinite(data.points) || data.points < 0)) {
      throw new BadRequestException('Nombre de points invalide');
    }

    return this.prisma.offerPack.update({
      where: { id },
      data: { ...data, title: data.title?.trim() },
    });
  }

  async remove(id: number) {
    const pack = await this.prisma.offerPack.findUnique({ where: { id } });
    if (!pack) throw new NotFoundException('Offre introuvable');
    await this.prisma.offerPack.delete({ where: { id } });
    return { success: true };
  }
}
