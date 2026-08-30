import { Controller, Get, Req, UseGuards, Put, Body, Query, NotFoundException, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Req() req: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        points: true,
        announces: {
          orderBy: { createdAt: 'desc' },
        },
        town: { include: { city: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = user;
    return result;
  }

  // Fusion de la logique d'update complète
  @UseGuards(JwtAuthGuard)
  @Put('profile')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'rcDocument', maxCount: 1 },
    { name: 'agreementDocument', maxCount: 1 },
    { name: 'agencyLogo', maxCount: 1 },
    { name: 'nifDocument', maxCount: 1 },
    { name: 'nisDocument', maxCount: 1 },
    { name: 'inapiDocument', maxCount: 1 },
  ], {
    storage: diskStorage({
      destination: './uploads/documents',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        return cb(null, `${file.fieldname}-${randomName}${extname(file.originalname)}`);
      }
    })
  }))
  async updateFullProfile(
    @Req() req: any,
    @Body() body: any,
    @UploadedFiles() files: {
      rcDocument?: Express.Multer.File[];
      agreementDocument?: Express.Multer.File[];
      agencyLogo?: Express.Multer.File[];
      nifDocument?: Express.Multer.File[];
      nisDocument?: Express.Multer.File[];
      inapiDocument?: Express.Multer.File[];
    },
  ) {
    const userId = req.user.userId;

    let rcDocumentUrl = undefined;
    let agreementDocumentUrl = undefined;
    let logoUrl = undefined;
    let nifDocumentUrl = undefined;
    let nisDocumentUrl = undefined;
    let inapiDocumentUrl = undefined;

    if (files?.rcDocument?.[0]) {
      rcDocumentUrl = `/uploads/documents/${files.rcDocument[0].filename}`;
    }
    if (files?.agreementDocument?.[0]) {
      agreementDocumentUrl = `/uploads/documents/${files.agreementDocument[0].filename}`;
    }
    if (files?.agencyLogo?.[0]) {
      logoUrl = `/uploads/documents/${files.agencyLogo[0].filename}`;
    }
    if (files?.nifDocument?.[0]) {
      nifDocumentUrl = `/uploads/documents/${files.nifDocument[0].filename}`;
    }
    if (files?.nisDocument?.[0]) {
      nisDocumentUrl = `/uploads/documents/${files.nisDocument[0].filename}`;
    }
    if (files?.inapiDocument?.[0]) {
      inapiDocumentUrl = `/uploads/documents/${files.inapiDocument[0].filename}`;
    }

    // Si le mot de passe est fourni, on le hash (pour la page info)
    let passwordHash = undefined;
    if (body.newPassword) {
      const bcrypt = require('bcrypt');
      passwordHash = await bcrypt.hash(body.newPassword, 10);
    }

    // Resolve the selected commune to the real database town id. The completion
    // form sends the wilaya code and commune name, while User stores a Town id.
    let resolvedTownId = body.townId ? Number(body.townId) : undefined;
    if (!resolvedTownId && body.commune && body.wilaya) {
      const town = await this.prisma.town.findFirst({
        where: {
          nameFr: body.commune,
          city: { code: Number(body.wilaya) },
        },
        select: { id: true },
      });
      resolvedTownId = town?.id;
    }

    // Keep a readable full address in addition to the normalized town id.
    let fullAddress = body.address;
    if (body.commune && body.wilaya) {
        fullAddress = `${body.address}, ${body.commune}, Wilaya ${body.wilaya}`;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        civility: body.civility,
        firstName: body.firstName,
        lastName: body.lastName,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
        phone: body.phone,
        landline: body.landline,
        address: fullAddress,
        townId: resolvedTownId,
        companyName: body.companyName,
        commercialRegister: body.commercialRegister,
        nif: body.nif,
        nis: body.nis,
        position: body.position,
        agreementExpiryDate: body.agreementExpiryDate ? new Date(body.agreementExpiryDate) : undefined,
        ...(passwordHash && { passwordHash }),
        ...(rcDocumentUrl && { rcDocumentUrl }),
        ...(agreementDocumentUrl && { agreementDocumentUrl }),
        ...(logoUrl && { agencyLogoUrl: logoUrl }),
        ...(nifDocumentUrl && { nifDocumentUrl }),
        ...(nisDocumentUrl && { nisDocumentUrl }),
        ...(inapiDocumentUrl && { inapiDocumentUrl }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        userType: true,
        companyName: true,
        companyActivity: true,
        agencyLogoUrl: true,
        phone: true,
        landline: true,
        civility: true,
        dateOfBirth: true,
        address: true,
        townId: true,
        town: { include: { city: true } },
        position: true,
        rcDocumentUrl: true,
        agreementDocumentUrl: true,
        nif: true,
        nis: true,
        nifDocumentUrl: true,
        nisDocumentUrl: true,
        inapiDocumentUrl: true,
        agreementExpiryDate: true,
      }
    });
  }

  @UseGuards(JwtAuthGuard)
  @Put('me')
  async updateProfile(@Req() req: any, @Body() data: { firstName?: string; lastName?: string }) {
    return this.prisma.user.update({
      where: { id: req.user.userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
      },
    });
  }

  // "Mes statistiques" — particulier : clics annonces, appels par canal, emails, messages
  // internes reçus, signalements sur ses annonces. Professionnel : + contacts via boutique et
  // abonnés (les vues de stories vivent dans la config JSON de la boutique côté frontend et sont
  // agrégées là-bas, pas ici).
  @UseGuards(JwtAuthGuard)
  @Get('me/stats')
  async getMyStats(@Req() req: any) {
    const userId = req.user.userId;

    const [announces, clicksByChannel, internalMessages, reports, boutiqueContacts, followers] = await Promise.all([
      this.prisma.announce.findMany({ where: { userId }, select: { nbViews: true } }),
      this.prisma.contactClick.groupBy({
        by: ['channel'],
        where: { ownerId: userId, announceId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.message.count({ where: { receiverId: userId } }),
      this.prisma.report.count({ where: { ownerId: userId } }),
      this.prisma.contactClick.count({ where: { ownerId: userId, announceId: null } }),
      this.prisma.boutiqueFollow.count({ where: { ownerId: userId } }),
    ]);

    const announceClicks = announces.reduce((sum, a) => sum + a.nbViews, 0);
    const byChannel: Record<string, number> = { CALL: 0, WHATSAPP: 0, TELEGRAM: 0, VIBER: 0, EMAIL: 0 };
    clicksByChannel.forEach((c) => { byChannel[c.channel] = c._count._all; });

    return {
      announceClicks,
      calls: {
        total: byChannel.CALL + byChannel.WHATSAPP + byChannel.TELEGRAM + byChannel.VIBER,
        byChannel: { CALL: byChannel.CALL, WHATSAPP: byChannel.WHATSAPP, TELEGRAM: byChannel.TELEGRAM, VIBER: byChannel.VIBER },
      },
      emails: byChannel.EMAIL,
      internalMessages,
      reports,
      boutiqueContacts,
      boutiqueFollowers: followers,
    };
  }

  // "Mes statistiques" — série temporelle par période, pour les graphiques en bas de la page.
  // Regroupe des évènements réellement datés (vues, clics, annonces publiées, points utilisés,
  // contacts boutique, signalements) en buckets jour/semaine/mois entre `from` et `to`.
  @UseGuards(JwtAuthGuard)
  @Get('me/stats/timeseries')
  async getMyStatsTimeseries(
    @Req() req: any,
    @Query('from') fromParam?: string,
    @Query('to') toParam?: string,
    @Query('granularity') granularityParam?: string,
  ) {
    const userId = req.user.userId;
    const granularity: 'day' | 'week' | 'month' = ['day', 'week', 'month'].includes(granularityParam || '')
      ? (granularityParam as 'day' | 'week' | 'month')
      : 'day';

    const to = toParam ? new Date(`${toParam}T23:59:59`) : new Date();
    const from = fromParam ? new Date(`${fromParam}T00:00:00`) : new Date(to.getTime() - 29 * 24 * 3600 * 1000);

    const bucketKey = (d: Date): string => {
      if (granularity === 'month') {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
      if (granularity === 'week') {
        const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dow = (date.getDay() + 6) % 7; // lundi = 0
        date.setDate(date.getDate() - dow);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Liste complète des buckets sur la période (même vides), pour un axe continu côté graphique.
    const bucketOrder: string[] = [];
    const seen = new Set<string>();
    {
      const cursor = new Date(from);
      const step = granularity === 'month' ? 1 : granularity === 'week' ? 7 : 1;
      while (cursor <= to) {
        const key = bucketKey(cursor);
        if (!seen.has(key)) { seen.add(key); bucketOrder.push(key); }
        if (granularity === 'month') cursor.setMonth(cursor.getMonth() + 1);
        else cursor.setDate(cursor.getDate() + step);
      }
      const lastKey = bucketKey(to);
      if (!seen.has(lastKey)) { seen.add(lastKey); bucketOrder.push(lastKey); }
    }

    type Bucket = { date: string; views: number; clicks: number; sale: number; rental: number; boutiqueContacts: number; reports: number; pointsUsed: number };
    const buckets = new Map<string, Bucket>();
    for (const key of bucketOrder) {
      buckets.set(key, { date: key, views: 0, clicks: 0, sale: 0, rental: 0, boutiqueContacts: 0, reports: 0, pointsUsed: 0 });
    }
    const bump = (key: string, field: keyof Omit<Bucket, 'date'>, amount = 1) => {
      const b = buckets.get(key);
      if (b) b[field] += amount;
    };

    const range = { gte: from, lte: to };
    const [views, clicks, boutiqueClicks, reports, announces, pointUsages] = await Promise.all([
      this.prisma.announceView.findMany({ where: { ownerId: userId, createdAt: range }, select: { createdAt: true } }),
      this.prisma.contactClick.findMany({ where: { ownerId: userId, announceId: { not: null }, createdAt: range }, select: { createdAt: true } }),
      this.prisma.contactClick.findMany({ where: { ownerId: userId, announceId: null, createdAt: range }, select: { createdAt: true } }),
      this.prisma.report.findMany({ where: { ownerId: userId, createdAt: range }, select: { createdAt: true } }),
      this.prisma.announce.findMany({ where: { userId, createdAt: range }, select: { createdAt: true, type: true } }),
      this.prisma.pointUsage.findMany({ where: { userId, usageDate: range }, select: { usageDate: true, pointsUsed: true } }),
    ]);

    views.forEach((v) => bump(bucketKey(v.createdAt), 'views'));
    clicks.forEach((c) => bump(bucketKey(c.createdAt), 'clicks'));
    boutiqueClicks.forEach((c) => bump(bucketKey(c.createdAt), 'boutiqueContacts'));
    reports.forEach((r) => bump(bucketKey(r.createdAt), 'reports'));
    announces.forEach((a) => bump(bucketKey(a.createdAt), a.type === 'SALE' ? 'sale' : 'rental'));
    pointUsages.forEach((p) => bump(bucketKey(p.usageDate), 'pointsUsed', p.pointsUsed));

    const series = bucketOrder.map((key) => buckets.get(key)!);
    const totals = series.reduce(
      (acc, b) => ({
        views: acc.views + b.views,
        clicks: acc.clicks + b.clicks,
        sale: acc.sale + b.sale,
        rental: acc.rental + b.rental,
        boutiqueContacts: acc.boutiqueContacts + b.boutiqueContacts,
        reports: acc.reports + b.reports,
        pointsUsed: acc.pointsUsed + b.pointsUsed,
      }),
      { views: 0, clicks: 0, sale: 0, rental: 0, boutiqueContacts: 0, reports: 0, pointsUsed: 0 },
    );

    return { granularity, from: from.toISOString(), to: to.toISOString(), series, totals };
  }
}
