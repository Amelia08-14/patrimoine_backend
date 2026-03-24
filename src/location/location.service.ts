import { Injectable } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';

type DatasetRow = Record<string, any>;

type CachedDataset = {
  fetchedAtMs: number;
  rows: DatasetRow[];
  citiesByCode: Map<number, { code: number; nameFr: string; nameAr?: string; nameEn?: string }>;
  townsByWilayaCode: Map<number, Array<{ code: number; nameFr: string; nameAr?: string; nameEn?: string }>>;
  townByCode: Map<number, { townCode: number; townNameFr: string; townNameAr?: string; townNameEn?: string; wilayaCode: number; wilayaNameFr: string; wilayaNameAr?: string; wilayaNameEn?: string }>;
};

const DEFAULT_DZ_DATA_URL = 'https://raw.githubusercontent.com/othmanus/algeria-cities/master/json/ascii/algeria_cities.json';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class LocationService {
  private cache: CachedDataset | null = null;

  private normalizeNumber(v: any): number | null {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  private normalizeString(v: any): string | undefined {
    if (v === null || v === undefined) return undefined;
    const s = String(v).trim();
    return s ? s : undefined;
  }

  private extractRow(row: DatasetRow) {
    const wilayaCode =
      this.normalizeNumber(row.wilaya_code) ??
      this.normalizeNumber(row.wilayaCode) ??
      this.normalizeNumber(row.wilaya) ??
      null;

    const townCode =
      this.normalizeNumber(row.commune_code) ??
      this.normalizeNumber(row.communeCode) ??
      this.normalizeNumber(row.id) ??
      null;

    const wilayaNameFr =
      this.normalizeString(row.wilaya_name_ascii) ??
      this.normalizeString(row.wilaya_name_fr) ??
      this.normalizeString(row.wilaya_name) ??
      this.normalizeString(row.wilayaNameAscii) ??
      this.normalizeString(row.wilayaName) ??
      undefined;

    const wilayaNameAr =
      this.normalizeString(row.wilaya_name_ar) ??
      (this.normalizeString(row.wilaya_name) && !wilayaNameFr ? this.normalizeString(row.wilaya_name) : undefined) ??
      this.normalizeString(row.wilayaNameAr) ??
      undefined;

    const wilayaNameEn = this.normalizeString(row.wilaya_name_en) ?? this.normalizeString(row.wilayaNameEn) ?? undefined;

    const townNameFr =
      this.normalizeString(row.commune_name_ascii) ??
      this.normalizeString(row.commune_name_fr) ??
      this.normalizeString(row.commune_name) ??
      this.normalizeString(row.communeNameAscii) ??
      this.normalizeString(row.communeName) ??
      undefined;

    const townNameAr =
      this.normalizeString(row.commune_name_ar) ??
      (this.normalizeString(row.commune_name) && !townNameFr ? this.normalizeString(row.commune_name) : undefined) ??
      this.normalizeString(row.communeNameAr) ??
      undefined;

    const townNameEn = this.normalizeString(row.commune_name_en) ?? this.normalizeString(row.communeNameEn) ?? undefined;

    if (!wilayaCode || !townCode || !townNameFr || !wilayaNameFr) return null;

    return {
      wilayaCode,
      wilayaNameFr,
      wilayaNameAr,
      wilayaNameEn,
      townCode,
      townNameFr,
      townNameAr,
      townNameEn,
    };
  }

  private async loadDataset(): Promise<CachedDataset> {
    const now = Date.now();
    if (this.cache && now - this.cache.fetchedAtMs < CACHE_TTL_MS) return this.cache;

    const url = process.env.DZ_DATA_URL || DEFAULT_DZ_DATA_URL;
    const rows = (await this.fetchJson(url)) as DatasetRow[];

    const citiesByCode = new Map<number, { code: number; nameFr: string; nameAr?: string; nameEn?: string }>();
    const townsByWilayaCode = new Map<number, Array<{ code: number; nameFr: string; nameAr?: string; nameEn?: string }>>();
    const townByCode = new Map<number, { townCode: number; townNameFr: string; townNameAr?: string; townNameEn?: string; wilayaCode: number; wilayaNameFr: string; wilayaNameAr?: string; wilayaNameEn?: string }>();

    for (const row of rows) {
      const extracted = this.extractRow(row);
      if (!extracted) continue;

      const { wilayaCode, wilayaNameFr, wilayaNameAr, wilayaNameEn, townCode, townNameFr, townNameAr, townNameEn } = extracted;

      if (!citiesByCode.has(wilayaCode)) {
        citiesByCode.set(wilayaCode, { code: wilayaCode, nameFr: wilayaNameFr, nameAr: wilayaNameAr, nameEn: wilayaNameEn });
      }

      const existingTowns = townsByWilayaCode.get(wilayaCode) || [];
      if (!existingTowns.some(t => t.code === townCode)) {
        existingTowns.push({ code: townCode, nameFr: townNameFr, nameAr: townNameAr, nameEn: townNameEn });
        townsByWilayaCode.set(wilayaCode, existingTowns);
      }

      if (!townByCode.has(townCode)) {
        townByCode.set(townCode, {
          townCode,
          townNameFr,
          townNameAr,
          townNameEn,
          wilayaCode,
          wilayaNameFr,
          wilayaNameAr,
          wilayaNameEn,
        });
      }
    }

    for (const towns of townsByWilayaCode.values()) {
      towns.sort((a, b) => a.nameFr.localeCompare(b.nameFr, 'fr'));
    }

    const cached: CachedDataset = { fetchedAtMs: now, rows, citiesByCode, townsByWilayaCode, townByCode };
    this.cache = cached;
    return cached;
  }

  private async fetchJson(url: string): Promise<unknown> {
    const u = new URL(url);
    const client = u.protocol === 'http:' ? http : https;

    return new Promise((resolve, reject) => {
      const req = client.get(
        u,
        {
          headers: {
            'accept': 'application/json',
            'user-agent': 'patrimoine-api',
          },
        },
        (res) => {
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
              const text = Buffer.concat(chunks).toString('utf8');
              resolve(JSON.parse(text));
            } catch (e) {
              reject(e);
            }
          });
        }
      );

      req.setTimeout(15_000, () => {
        req.destroy(new Error('Timeout'));
      });
      req.on('error', reject);
    });
  }


  async listCities() {
    try {
      const dataset = await this.loadDataset();
      return Array.from(dataset.citiesByCode.values()).sort((a, b) => a.code - b.code).map(c => ({
        id: c.code,
        code: c.code,
        nameFr: c.nameFr,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
      }));
    } catch {
      return [];
    }
  }

  async listTownsByCityCode(cityCode: number) {
    try {
      const dataset = await this.loadDataset();
      const towns = dataset.townsByWilayaCode.get(cityCode) || [];
      return towns.map(t => ({
        id: t.code,
        code: t.code,
        nameFr: t.nameFr,
        nameAr: t.nameAr,
        nameEn: t.nameEn,
      }));
    } catch {
      return [];
    }
  }
}
