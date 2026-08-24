import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminService } from '../admin/admin.service';
import { ContentService } from './content.service';
import { PartnerCategory } from '@prisma/client';

@Controller()
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly adminService: AdminService,
  ) {}

  // ── PUBLIC ──

  @Get('content/settings')
  getSettings() {
    return this.contentService.getSettings();
  }

  @Get('content/legal/:page')
  getLegalSections(@Param('page') page: string) {
    return this.contentService.getLegalSections(page.toUpperCase(), true);
  }

  @Get('content/faq')
  getFaq() {
    return this.contentService.getFaqItems(true);
  }

  @Get('content/partners')
  getPartners(@Query('category') category?: PartnerCategory) {
    return this.contentService.getPartners(true, category);
  }

  // ── ADMIN ──

  @Put('admin/content/settings')
  @UseGuards(JwtAuthGuard)
  async updateSettings(@Req() req: any, @Body() body: Record<string, string>) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.setSettings(body);
  }

  @Get('admin/content/legal/:page')
  @UseGuards(JwtAuthGuard)
  async adminGetLegalSections(@Req() req: any, @Param('page') page: string) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.getLegalSections(page.toUpperCase(), false);
  }

  @Post('admin/content/legal/:page')
  @UseGuards(JwtAuthGuard)
  async createLegalSection(@Req() req: any, @Param('page') page: string, @Body() body: { title: string; body: string; order?: number }) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.createLegalSection(page.toUpperCase(), body.title, body.body, body.order ?? 0);
  }

  @Put('admin/content/legal/section/:id')
  @UseGuards(JwtAuthGuard)
  async updateLegalSection(@Req() req: any, @Param('id') id: string, @Body() body: { title?: string; body?: string; order?: number; published?: boolean }) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.updateLegalSection(Number(id), body);
  }

  @Delete('admin/content/legal/section/:id')
  @UseGuards(JwtAuthGuard)
  async deleteLegalSection(@Req() req: any, @Param('id') id: string) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.deleteLegalSection(Number(id));
  }

  @Get('admin/content/faq')
  @UseGuards(JwtAuthGuard)
  async adminGetFaq(@Req() req: any) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.getFaqItems(false);
  }

  @Post('admin/content/faq')
  @UseGuards(JwtAuthGuard)
  async createFaqItem(@Req() req: any, @Body() body: { question: string; answer: string; order?: number }) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.createFaqItem(body.question, body.answer, body.order ?? 0);
  }

  @Put('admin/content/faq/:id')
  @UseGuards(JwtAuthGuard)
  async updateFaqItem(@Req() req: any, @Param('id') id: string, @Body() body: { question?: string; answer?: string; order?: number; published?: boolean }) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.updateFaqItem(Number(id), body);
  }

  @Delete('admin/content/faq/:id')
  @UseGuards(JwtAuthGuard)
  async deleteFaqItem(@Req() req: any, @Param('id') id: string) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.deleteFaqItem(Number(id));
  }

  @Get('admin/content/partners')
  @UseGuards(JwtAuthGuard)
  async adminGetPartners(@Req() req: any) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.getPartners(false);
  }

  @Post('admin/content/partners')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('logo', {
    storage: diskStorage({
      destination: './uploads/partners',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        return cb(null, `${randomName}${extname(file.originalname)}`);
      },
    }),
  }))
  async createPartner(
    @Req() req: any,
    @Body() body: { name: string; websiteUrl?: string; category?: PartnerCategory; order?: string },
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.createPartner({
      name: body.name,
      websiteUrl: body.websiteUrl,
      category: body.category || undefined,
      order: body.order ? Number(body.order) : 0,
      logoUrl: logo ? `/uploads/partners/${logo.filename}` : undefined,
    });
  }

  @Put('admin/content/partners/:id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('logo', {
    storage: diskStorage({
      destination: './uploads/partners',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        return cb(null, `${randomName}${extname(file.originalname)}`);
      },
    }),
  }))
  async updatePartner(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; websiteUrl?: string; category?: PartnerCategory | ''; order?: string; published?: string },
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.updatePartner(Number(id), {
      name: body.name,
      websiteUrl: body.websiteUrl,
      category: body.category !== undefined ? (body.category || null) : undefined,
      order: body.order !== undefined ? Number(body.order) : undefined,
      published: body.published !== undefined ? body.published === 'true' : undefined,
      logoUrl: logo ? `/uploads/partners/${logo.filename}` : undefined,
    });
  }

  @Delete('admin/content/partners/:id')
  @UseGuards(JwtAuthGuard)
  async deletePartner(@Req() req: any, @Param('id') id: string) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.deletePartner(Number(id));
  }
}
