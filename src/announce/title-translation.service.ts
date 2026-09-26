import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';

export type Variants = { fr: string; ar: string; en: string };
export type ListingTranslation = { title?: Variants; description?: Variants };

const SYSTEM_PROMPT = `You are a careful translator and copy-editor for real-estate listings on an Algerian property website.
The user message is a JSON object {"title": "...", "description": "..."} typed by a user in French, Arabic or English,
possibly with typos, wrong casing or missing accents. Either field may be empty.
Return ONLY a JSON object, no prose, no markdown, in this exact shape:
{"title": {"fr": "...", "ar": "...", "en": "..."}, "description": {"fr": "...", "ar": "...", "en": "..."}}
Omit a key (title or description) when the corresponding input is empty.
Each value is the corrected text in that language:
- fix spelling, accents, casing and obvious typos;
- keep the meaning and the style; NEVER add, remove or invent information; keep the description as long as the original and keep its line breaks;
- the title stays short, like the original;
- keep numbers, units, phone numbers, brand names and proper names (places, agencies) unchanged, transliterating names when the language requires;
- if a text is meaningless or a random string, return it unchanged in all three languages.`;

/**
 * Correction + traduction automatique (fr / ar / en) du TITRE et de la DESCRIPTION d'une annonce, à la création.
 *
 * Utilise l'API Anthropic (`ANTHROPIC_API_KEY` dans l'environnement ou dans le `.env` de l'API ; modèle par défaut
 * Haiku, surchargeable avec `ANTHROPIC_MODEL`). Sans clé, ou en cas d'erreur / de délai dépassé, on ne fait RIEN :
 * les textes saisis restent tels quels et l'annonce n'est jamais bloquée. Le traitement est asynchrone (voir
 * [scheduleForAnnounce]) — le déposant n'attend pas la traduction.
 */
@Injectable()
export class TitleTranslationService {
  private readonly logger = new Logger(TitleTranslationService.name);
  private warnedNoKey = false;

  constructor(private prisma: PrismaService) {}

  /**
   * Ce projet ne charge pas le `.env` dans `process.env` (pas de ConfigModule) : on lit donc d'abord la
   * variable d'environnement du serveur, puis, à défaut, le fichier `.env` à la racine de l'API.
   */
  private env(name: string): string | undefined {
    if (process.env[name]) return process.env[name];
    try {
      const text = readFileSync(join(process.cwd(), '.env'), 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
        if (m && m[1] === name) return m[2].replace(/^["']|["']$/g, '').trim() || undefined;
      }
    } catch {
      // pas de .env lisible : on s'en tient à process.env
    }
    return undefined;
  }

  private get apiKey(): string | undefined {
    return this.env('ANTHROPIC_API_KEY');
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  async translate(rawTitle?: string | null, rawDescription?: string | null): Promise<ListingTranslation | null> {
    const title = (rawTitle || '').trim();
    const description = (rawDescription || '').trim();
    if (!title && !description) return null;
    if (!this.apiKey) {
      if (!this.warnedNoKey) {
        this.logger.warn("ANTHROPIC_API_KEY absent : les titres et descriptions d'annonces ne sont ni corrigés ni traduits.");
        this.warnedNoKey = true;
      }
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey as string,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.env('ANTHROPIC_MODEL') || 'claude-haiku-4-5-20251001',
          max_tokens: 3000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: JSON.stringify({ title, description }) }],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`Traduction de l'annonce : HTTP ${res.status} ${body.slice(0, 200)}`);
        return null;
      }
      const data: any = await res.json();
      const text: string = (data?.content || []).map((c: any) => c?.text || '').join('');
      const parsed = this.parse(text, !!title, !!description);
      if (!parsed) this.logger.warn(`Réponse de traduction inexploitable : ${text.slice(0, 200)}`);
      return parsed;
    } catch (e: any) {
      this.logger.warn(`Traduction de l'annonce impossible : ${e?.message || e}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private variants(v: any, max: number): Variants | undefined {
    if (!v || typeof v !== 'object') return undefined;
    const clean = (x: unknown) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
    const out = { fr: clean(v.fr), ar: clean(v.ar), en: clean(v.en) };
    return out.fr && out.ar && out.en ? out : undefined;
  }

  /** Extrait le JSON de la réponse (tolère du texte autour) ; null si rien d'exploitable. */
  private parse(text: string, wantTitle: boolean, wantDescription: boolean): ListingTranslation | null {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      const obj = JSON.parse(text.slice(start, end + 1));
      const out: ListingTranslation = {};
      if (wantTitle) out.title = this.variants(obj.title, 191);
      if (wantDescription) out.description = this.variants(obj.description, 20000);
      return out.title || out.description ? out : null;
    } catch {
      return null;
    }
  }

  private toUpdate(t: ListingTranslation) {
    return {
      ...(t.title ? { title: t.title.fr, titleAr: t.title.ar, titleEn: t.title.en } : {}),
      ...(t.description
        ? { shortDescription: t.description.fr, shortDescriptionAr: t.description.ar, shortDescriptionEn: t.description.en }
        : {}),
    };
  }

  /**
   * Rattrapage : traduit les annonces existantes dont le titre OU la description n'a pas encore de traduction.
   * Séquentiel (pas de rafale d'appels), borné par `limit` ; renvoie un bilan lisible.
   */
  async backfillMissing(limit = 100) {
    if (!this.isConfigured) {
      return { keyConfigured: false, processed: 0, translated: 0, failed: 0, remaining: null as number | null };
    }
    const pending = {
      OR: [
        { title: { not: null }, titleAr: null },
        { shortDescription: { not: null }, shortDescriptionAr: null },
      ],
    };
    const rows = await this.prisma.announce.findMany({
      where: pending,
      select: { id: true, title: true, shortDescription: true, titleAr: true, shortDescriptionAr: true },
      orderBy: { id: 'desc' },
      take: limit,
    });
    let translated = 0;
    let failed = 0;
    for (const row of rows) {
      const result = await this.translate(row.titleAr ? null : row.title, row.shortDescriptionAr ? null : row.shortDescription);
      if (!result) {
        failed++;
        continue;
      }
      await this.prisma.announce.update({ where: { id: row.id }, data: this.toUpdate(result) });
      translated++;
    }
    const remaining = await this.prisma.announce.count({ where: pending });
    return { keyConfigured: true, processed: rows.length, translated, failed, remaining };
  }

  /**
   * Lance la correction/traduction en arrière-plan puis enregistre : `title` / `shortDescription` deviennent la
   * version française corrigée (le français est la langue de repli du site), les colonnes `…Ar` / `…En` reçoivent
   * les traductions.
   */
  scheduleForAnnounce(announceId: number, rawTitle?: string | null, rawDescription?: string | null): void {
    if (!(rawTitle && rawTitle.trim()) && !(rawDescription && rawDescription.trim())) return;
    void this.translate(rawTitle, rawDescription)
      .then(async (result) => {
        if (!result) return;
        await this.prisma.announce.update({ where: { id: announceId }, data: this.toUpdate(result) });
      })
      .catch((e) => this.logger.warn(`Enregistrement de la traduction impossible (annonce ${announceId}) : ${e?.message || e}`));
  }
}
