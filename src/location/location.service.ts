import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Sert le référentiel des wilayas/communes depuis la base (tables City/Town), matérialisé une
// fois pour toutes par `prisma/seed-locations.ts`. Les ids renvoyés sont donc de vrais
// City.id/Town.id, exploitables tels quels comme townId/cityId partout ailleurs dans l'app
// (inscription, complétion de profil, filtres admin). Avant ce correctif, ce service proxyait
// un jeu de données externe à la volée et renvoyait ses propres codes comme "id" — des valeurs
// sans aucun rapport avec les vraies lignes City/Town, ce qui rendait tout townId envoyé par un
// formulaire impossible à relier en base (filtres wilaya/commune muets partout).
@Injectable()
export class LocationService {
  constructor(private readonly prisma: PrismaService) {}

  async listCities() {
    const cities = await this.prisma.city.findMany({ orderBy: { code: 'asc' } });
    return cities.map((c) => ({ id: c.id, code: c.code, nameFr: c.nameFr, nameAr: c.nameAr, nameEn: c.nameEn }));
  }

  async listTownsByCityCode(cityId: number) {
    const towns = await this.prisma.town.findMany({ where: { cityId }, orderBy: { nameFr: 'asc' } });
    return towns.map((t) => ({ id: t.id, code: t.code, nameFr: t.nameFr, nameAr: t.nameAr, nameEn: t.nameEn }));
  }
}
