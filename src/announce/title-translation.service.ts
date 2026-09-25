import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';

export type TitleVariants = { fr: string; ar: string; en: string };

const SYSTEM_PROMPT = `You are a careful translator and copy-editor for real-estate listing titles on an Algerian property website.
The input is a listing title typed by a user in French, Arabic or English, possibly with typos, wrong casing or missing accents.
Return ONLY a JSON object, no prose, no markdown: {"fr": "...", "ar": "...", "en": "..."}.
Each value is the corrected title in that language:
- fix spelling, accents, casing and obvious typos;
- keep the meaning, keep it short and in the same style, do not add any information;
- keep numbers, units, brand names and proper names (places, agencies) unchanged, transliterating them when the language requires;
- if the text is meaningless or a random string, return it unchanged in all three fields.`;

/**
 * Correction + traduction automatique (fr / ar / en) du titre d'une annonce, à la création.
 *
 * Utilise l'API Anthropic (variable d'environnement `ANTHROPIC_API_KEY` ; modèle par défaut Haiku, surchargeable
 * avec `ANTHROPIC_MODEL`). Sans clé, ou en cas d'erreur / de délai dépassé, on ne fait RIEN : le titre saisi reste
 * tel quel et l'annonce n'est jamais bloquée. Le traitement est asynchrone (voir [scheduleForAnnounce]) — le
 * déposant n'attend pas la traduction.
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

  async translate(rawTitle: string): Promise<TitleVariants | null> {
    const title = (rawTitle || '').trim();
    if (!title) return null;
    if (!this.apiKey) {
      if (!this.warnedNoKey) {
        this.logger.warn('ANTHROPIC_API_KEY absent : les titres d\'annonces ne sont ni corrigés ni traduits.');
        this.warnedNoKey = true;
      }
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.env('ANTHROPIC_MODEL') || 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: title }],
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Traduction du titre : HTTP ${res.status}`);
        return null;
      }
      const data: any = await res.json();
      const text: string = (data?.content || []).map((c: any) => c?.text || '').join('');
      return this.parse(text);
    } catch (e: any) {
      this.logger.warn(`Traduction du titre impossible : ${e?.message || e}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Extrait le JSON {fr, ar, en} de la réponse (tolère du texte autour) ; null si invalide. */
  private parse(text: string): TitleVariants | null {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      const obj = JSON.parse(text.slice(start, end + 1));
      const clean = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 191) : '');
      const out = { fr: clean(obj.fr), ar: clean(obj.ar), en: clean(obj.en) };
      return out.fr && out.ar && out.en ? out : null;
    } catch {
      return null;
    }
  }

  /**
   * Rattrapage : traduit les annonces existantes dont `titleAr` est vide. Séquentiel (pas de rafale d'appels),
   * borné par `limit` ; renvoie un bilan lisible (dont la raison si la clé manque).
   */
  async backfillMissing(limit = 100) {
    if (!this.isConfigured) {
      return { keyConfigured: false, processed: 0, translated: 0, failed: 0, remaining: null as number | null };
    }
    const rows = await this.prisma.announce.findMany({
      where: { title: { not: null }, titleAr: null },
      select: { id: true, title: true },
      orderBy: { id: 'desc' },
      take: limit,
    });
    let translated = 0;
    let failed = 0;
    for (const row of rows) {
      const variants = await this.translate(row.title || '');
      if (!variants) {
        failed++;
        continue;
      }
      await this.prisma.announce.update({ where: { id: row.id }, data: { title: variants.fr, titleAr: variants.ar, titleEn: variants.en } });
      translated++;
    }
    const remaining = await this.prisma.announce.count({ where: { title: { not: null }, titleAr: null } });
    return { keyConfigured: true, processed: rows.length, translated, failed, remaining };
  }

  /**
   * Lance la correction/traduction en arrière-plan puis enregistre : `title` devient la version française
   * corrigée (le français est la langue de repli du site), `titleAr` / `titleEn` reçoivent les traductions.
   */
  scheduleForAnnounce(announceId: number, rawTitle?: string | null): void {
    if (!rawTitle || !rawTitle.trim()) return;
    void this.translate(rawTitle)
      .then(async (variants) => {
        if (!variants) return;
        await this.prisma.announce.update({
          where: { id: announceId },
          data: { title: variants.fr, titleAr: variants.ar, titleEn: variants.en },
        });
      })
      .catch((e) => this.logger.warn(`Enregistrement du titre traduit impossible (annonce ${announceId}) : ${e?.message || e}`));
  }
}
