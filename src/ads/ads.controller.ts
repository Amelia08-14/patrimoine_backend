import { Controller, Get, Post, Put, Delete, Param, ParseIntPipe, Query, Body, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminService } from '../admin/admin.service';
import { AdsService, AdInput } from './ads.service';

const imageUpload = FileInterceptor('image', {
  storage: diskStorage({
    destination: './uploads/ads',
    filename: (req, file, cb) => {
      const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
      return cb(null, `${randomName}${extname(file.originalname)}`);
    },
  }),
});

type AdBody = Record<string, string | undefined>;

// Convertit le corps multipart (tout en texte) en données typées ; un champ absent n'est pas modifié.
function parseBody(body: AdBody): AdInput {
  const out: AdInput = {};
  const text = (k: string) => (body[k] !== undefined ? ((body[k] as string).trim() || null) : undefined);
  const set = (k: keyof AdInput, v: any) => { if (v !== undefined) (out as any)[k] = v; };
  if (body.name !== undefined) out.name = (body.name || '').trim();
  ['link', 'title', 'titleAr', 'titleEn', 'subtitle', 'subtitleAr', 'subtitleEn', 'buttonLabel', 'buttonLabelAr', 'buttonLabelEn']
    .forEach((k) => set(k as keyof AdInput, text(k)));
  if (body.placements !== undefined) out.placements = body.placements;
  if (body.pages !== undefined) out.pages = body.pages;
  if (body.categories !== undefined) out.categories = body.categories;
  if (body.isActive !== undefined) out.isActive = body.isActive === 'true';
  if (body.startDate !== undefined) out.startDate = body.startDate ? new Date(body.startDate) : null;
  if (body.endDate !== undefined) out.endDate = body.endDate ? new Date(`${body.endDate}T23:59:59`) : null;
  if (body.order !== undefined) out.order = Number(body.order) || 0;
  return out;
}

@Controller()
export class AdsController {
  constructor(private readonly ads: AdsService, private readonly adminService: AdminService) {}

  // ── PUBLIC ──
  @Get('ads')
  list(@Query('page') page?: string, @Query('placement') placement?: string) {
    return this.ads.getPublic(page, placement);
  }

  @Post('ads/:id/view')
  view(@Param('id', ParseIntPipe) id: number) {
    return this.ads.trackView(id);
  }

  @Post('ads/:id/click')
  click(@Param('id', ParseIntPipe) id: number) {
    return this.ads.trackClick(id);
  }

  // ── ADMIN ──
  @Get('admin/ads')
  @UseGuards(JwtAuthGuard)
  async adminList(@Req() req: any) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.ads.getAll();
  }

  @Post('admin/ads')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(imageUpload)
  async create(@Req() req: any, @Body() body: AdBody, @UploadedFile() image?: Express.Multer.File) {
    await this.adminService.checkAdmin(req.user.userId);
    if (!image) throw new BadRequestException('Image requise');
    const data = parseBody(body);
    if (!data.name) throw new BadRequestException('Nom requis');
    return this.ads.create({ ...data, name: data.name, imageUrl: `/uploads/ads/${image.filename}` });
  }

  @Put('admin/ads/:id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(imageUpload)
  async update(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: AdBody, @UploadedFile() image?: Express.Multer.File) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.ads.update(id, { ...parseBody(body), ...(image ? { imageUrl: `/uploads/ads/${image.filename}` } : {}) });
  }

  @Delete('admin/ads/:id')
  @UseGuards(JwtAuthGuard)
  async remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.ads.remove(id);
  }
}
