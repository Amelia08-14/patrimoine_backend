import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerCategory, CompanyActivity } from '@prisma/client';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Réglages simples (clé/valeur) : contact, support, etc. ---

  async getSettings() {
    const rows = await this.prisma.siteSetting.findMany();
    return rows.reduce((acc, r) => ({ ...acc, [r.key]: r.value }), {} as Record<string, string>);
  }

  async setSettings(entries: Record<string, string>) {
    await this.prisma.$transaction(
      Object.entries(entries).map(([key, value]) =>
        this.prisma.siteSetting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        }),
      ),
    );
    return this.getSettings();
  }

  // --- Sections de pages légales (CGU / Confidentialité) ---

  async getLegalSections(page: string, publishedOnly: boolean) {
    return this.prisma.legalSection.findMany({
      where: { page, ...(publishedOnly ? { published: true } : {}) },
      orderBy: { order: 'asc' },
    });
  }

  async createLegalSection(page: string, title: string, body: string, order: number, imageUrl?: string) {
    return this.prisma.legalSection.create({ data: { page, title, body, order, imageUrl } });
  }

  async updateLegalSection(id: number, data: { title?: string; body?: string; order?: number; published?: boolean; imageUrl?: string | null }) {
    return this.prisma.legalSection.update({ where: { id }, data });
  }

  async deleteLegalSection(id: number) {
    return this.prisma.legalSection.delete({ where: { id } });
  }

  // --- FAQ ---

  async getFaqItems(publishedOnly: boolean) {
    return this.prisma.faqItem.findMany({
      where: publishedOnly ? { published: true } : {},
      orderBy: { order: 'asc' },
    });
  }

  async createFaqItem(question: string, answer: string, order: number) {
    return this.prisma.faqItem.create({ data: { question, answer, order } });
  }

  async updateFaqItem(id: number, data: { question?: string; answer?: string; order?: number; published?: boolean }) {
    const item = await this.prisma.faqItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Question introuvable');
    return this.prisma.faqItem.update({ where: { id }, data });
  }

  async deleteFaqItem(id: number) {
    return this.prisma.faqItem.delete({ where: { id } });
  }

  // --- Partenaires ---

  async getPartners(publishedOnly: boolean, category?: PartnerCategory, subCategory?: CompanyActivity) {
    return this.prisma.partner.findMany({
      where: {
        ...(publishedOnly ? { published: true } : {}),
        ...(category ? { category } : {}),
        ...(subCategory ? { subCategory } : {}),
      },
      orderBy: { order: 'asc' },
    });
  }

  async createPartner(data: { name: string; logoUrl?: string; websiteUrl?: string; category?: PartnerCategory; subCategory?: CompanyActivity; order: number }) {
    return this.prisma.partner.create({ data });
  }

  async updatePartner(id: number, data: { name?: string; logoUrl?: string; websiteUrl?: string; category?: PartnerCategory | null; subCategory?: CompanyActivity | null; order?: number; published?: boolean }) {
    const item = await this.prisma.partner.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Partenaire introuvable');
    return this.prisma.partner.update({ where: { id }, data });
  }

  async deletePartner(id: number) {
    return this.prisma.partner.delete({ where: { id } });
  }

  // --- Liens Utiles (affichés automatiquement dans le footer du site public) ---

  async getUsefulLinks(publishedOnly: boolean) {
    return this.prisma.usefulLink.findMany({
      where: publishedOnly ? { published: true } : {},
      orderBy: { order: 'asc' },
    });
  }

  async createUsefulLink(title: string, url: string, order: number) {
    return this.prisma.usefulLink.create({ data: { title, url, order } });
  }

  async updateUsefulLink(id: number, data: { title?: string; url?: string; order?: number; published?: boolean }) {
    const item = await this.prisma.usefulLink.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Lien introuvable');
    return this.prisma.usefulLink.update({ where: { id }, data });
  }

  async deleteUsefulLink(id: number) {
    return this.prisma.usefulLink.delete({ where: { id } });
  }
}
