// Seed unique des wilayas/communes réelles dans les tables City/Town.
//
// Contexte : /cities et /cities/:code/towns (LocationService) ne lisaient jusqu'ici jamais la
// base — ils interrogeaient un jeu de données externe (GitHub) à la volée et renvoyaient ses
// codes comme "id". Or User.townId / Address.townId sont des clés étrangères vers de vraies
// lignes City/Town en base. Résultat : tous les filtres wilaya/commune (admin, KPI points,
// inscription, complétion de profil) envoyaient des identifiants qui ne correspondaient à
// aucune ligne réelle -> townId jamais résolu, filtres "wilaya" muets partout.
//
// Ce script matérialise une bonne fois pour toutes le référentiel complet (58 wilayas +
// communes) dans City/Town, à partir de la même source que LocationService. Idempotent
// (upsert par `code`, qui est @unique) : peut être relancé sans dupliquer.
//
// Usage : npx ts-node prisma/seed-locations.ts

import { PrismaClient } from '@prisma/client';
import * as https from 'https';
import * as http from 'http';

const prisma = new PrismaClient();

const DEFAULT_DZ_DATA_URL = 'https://raw.githubusercontent.com/othmanus/algeria-cities/master/json/ascii/algeria_cities.json';

type DatasetRow = Record<string, any>;

function normalizeNumber(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeString(v: any): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

// Extraction identique à LocationService.extractRow (même source, même mapping de champs).
function extractRow(row: DatasetRow) {
  const wilayaCode = normalizeNumber(row.wilaya_code) ?? normalizeNumber(row.wilayaCode) ?? normalizeNumber(row.wilaya) ?? null;
  const townCode = normalizeNumber(row.commune_code) ?? normalizeNumber(row.communeCode) ?? normalizeNumber(row.id) ?? null;

  const wilayaNameFr =
    normalizeString(row.wilaya_name_ascii) ?? normalizeString(row.wilaya_name_fr) ?? normalizeString(row.wilaya_name) ??
    normalizeString(row.wilayaNameAscii) ?? normalizeString(row.wilayaName) ?? undefined;
  const wilayaNameAr =
    normalizeString(row.wilaya_name_ar) ??
    (normalizeString(row.wilaya_name) && !wilayaNameFr ? normalizeString(row.wilaya_name) : undefined) ??
    normalizeString(row.wilayaNameAr) ?? undefined;
  const wilayaNameEn = normalizeString(row.wilaya_name_en) ?? normalizeString(row.wilayaNameEn) ?? undefined;

  const townNameFr =
    normalizeString(row.commune_name_ascii) ?? normalizeString(row.commune_name_fr) ?? normalizeString(row.commune_name) ??
    normalizeString(row.communeNameAscii) ?? normalizeString(row.communeName) ?? undefined;
  const townNameAr =
    normalizeString(row.commune_name_ar) ??
    (normalizeString(row.commune_name) && !townNameFr ? normalizeString(row.commune_name) : undefined) ??
    normalizeString(row.communeNameAr) ?? undefined;
  const townNameEn = normalizeString(row.commune_name_en) ?? normalizeString(row.communeNameEn) ?? undefined;

  if (!wilayaCode || !townCode || !townNameFr || !wilayaNameFr) return null;
  return { wilayaCode, wilayaNameFr, wilayaNameAr, wilayaNameEn, townCode, townNameFr, townNameAr, townNameEn };
}

function fetchJson(url: string): Promise<unknown> {
  const u = new URL(url);
  const client = u.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    const req = client.get(u, { headers: { accept: 'application/json', 'user-agent': 'patrimoine-api-seed' } }, (res) => {
      const statusCode = res.statusCode || 0;
      if (statusCode < 200 || statusCode >= 300) {
        res.resume();
        reject(new Error(`HTTP ${statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.setTimeout(20_000, () => req.destroy(new Error('Timeout')));
    req.on('error', reject);
  });
}

async function main() {
  const url = process.env.DZ_DATA_URL || DEFAULT_DZ_DATA_URL;
  console.log(`Téléchargement du référentiel wilayas/communes depuis ${url} ...`);
  const rows = (await fetchJson(url)) as DatasetRow[];
  console.log(`${rows.length} lignes reçues.`);

  const cityIdByCode = new Map<number, number>();
  let citiesCreated = 0;
  let citiesUpdated = 0;
  let townsCreated = 0;
  let townsUpdated = 0;
  let skipped = 0;

  // 1) Villes (wilayas) d'abord, pour disposer de leur id réel avant de créer les communes.
  const seenWilayaCodes = new Set<number>();
  for (const row of rows) {
    const extracted = extractRow(row);
    if (!extracted) { skipped++; continue; }
    if (seenWilayaCodes.has(extracted.wilayaCode)) continue;
    seenWilayaCodes.add(extracted.wilayaCode);

    const existing = await prisma.city.findUnique({ where: { code: extracted.wilayaCode } });
    if (existing) {
      await prisma.city.update({
        where: { id: existing.id },
        data: { nameFr: extracted.wilayaNameFr, nameAr: extracted.wilayaNameAr || existing.nameAr, nameEn: extracted.wilayaNameEn || existing.nameEn },
      });
      cityIdByCode.set(extracted.wilayaCode, existing.id);
      citiesUpdated++;
    } else {
      const created = await prisma.city.create({
        data: {
          code: extracted.wilayaCode,
          nameFr: extracted.wilayaNameFr,
          nameAr: extracted.wilayaNameAr || extracted.wilayaNameFr,
          nameEn: extracted.wilayaNameEn || extracted.wilayaNameFr,
        },
      });
      cityIdByCode.set(extracted.wilayaCode, created.id);
      citiesCreated++;
    }
  }

  // 2) Communes, rattachées à la ville résolue à l'étape 1.
  const seenTownCodes = new Set<number>();
  for (const row of rows) {
    const extracted = extractRow(row);
    if (!extracted) continue;
    if (seenTownCodes.has(extracted.townCode)) continue;
    seenTownCodes.add(extracted.townCode);

    const cityId = cityIdByCode.get(extracted.wilayaCode);
    if (!cityId) continue;

    const existing = await prisma.town.findUnique({ where: { code: extracted.townCode } });
    if (existing) {
      await prisma.town.update({
        where: { id: existing.id },
        data: { nameFr: extracted.townNameFr, nameAr: extracted.townNameAr || existing.nameAr, nameEn: extracted.townNameEn || existing.nameEn, cityId },
      });
      townsUpdated++;
    } else {
      await prisma.town.create({
        data: {
          code: extracted.townCode,
          nameFr: extracted.townNameFr,
          nameAr: extracted.townNameAr || extracted.townNameFr,
          nameEn: extracted.townNameEn || extracted.townNameFr,
          cityId,
        },
      });
      townsCreated++;
    }
  }

  console.log(`Wilayas : ${citiesCreated} créées, ${citiesUpdated} mises à jour.`);
  console.log(`Communes : ${townsCreated} créées, ${townsUpdated} mises à jour.`);
  if (skipped) console.log(`${skipped} lignes ignorées (champs manquants dans le jeu de données source).`);
}

main()
  .catch((e) => {
    console.error('Échec du seed locations :', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
