import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Req, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminService } from '../admin/admin.service';
import { ContentService } from './content.service';
import { PartnerCategory, CompanyActivity, PartnerApplicationStatus } from '@prisma/client';

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

  @Get('content/useful-links')
  getUsefulLinks() {
    return this.contentService.getUsefulLinks(true);
  }

  @Get('content/hero-slides')
  getHeroSlides() {
    return this.contentService.getHeroSlides(true);
  }

  @Get('content/partners')
  getPartners(@Query('category') category?: PartnerCategory, @Query('subCategory') subCategory?: CompanyActivity) {
    return this.contentService.getPartners(true, category, subCategory);
  }

  @Post('content/partner-applications')
  @UseInterceptors(FileInterceptor('logo', {
    storage: diskStorage({
      destination: './uploads/partners',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        return cb(null, `${randomName}${extname(file.originalname)}`);
      },
    }),
  }))
  async createPartnerApplication(
    @Body() body: { companyName: string; contactName: string; email: string; phone: string; category?: PartnerCategory; subCategory?: CompanyActivity; websiteUrl?: string; message?: string },
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    if (!body.companyName || !body.contactName || !body.email || !body.phone) {
      throw new BadRequestException('Nom de l\'entreprise, contact, email et téléphone sont requis');
    }
    return this.contentService.createPartnerApplication({
      companyName: body.companyName,
      contactName: body.contactName,
      email: body.email,
      phone: body.phone,
      category: body.category || undefined,
      subCategory: body.subCategory || undefined,
      websiteUrl: body.websiteUrl || undefined,
      message: body.message || undefined,
      logoUrl: logo ? `/uploads/partners/${logo.filename}` : undefined,
    });
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
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: './uploads/legal',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        return cb(null, `${randomName}${extname(file.originalname)}`);
      },
    }),
  }))
  async createLegalSection(
    @Req() req: any,
    @Param('page') page: string,
    @Body() body: { title: string; body: string; order?: string },
    @UploadedFile() image?: Express.Multer.File,
  ) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.createLegalSection(
      page.toUpperCase(),
      body.title,
      body.body,
      body.order ? Number(body.order) : 0,
      image ? `/uploads/legal/${image.filename}` : undefined,
    );
  }

  @Put('admin/content/legal/section/:id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: './uploads/legal',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        return cb(null, `${randomName}${extname(file.originalname)}`);
      },
    }),
  }))
  async updateLegalSection(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { title?: string; body?: string; order?: string; published?: string; removeImage?: string },
    @UploadedFile() image?: Express.Multer.File,
  ) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.updateLegalSection(Number(id), {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.body !== undefined ? { body: body.body } : {}),
      ...(body.order !== undefined ? { order: Number(body.order) } : {}),
      ...(body.published !== undefined ? { published: body.published === 'true' } : {}),
      ...(image ? { imageUrl: `/uploads/legal/${image.filename}` } : {}),
      ...(!image && body.removeImage === 'true' ? { imageUrl: null } : {}),
    });
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
    @Body() body: { name: string; websiteUrl?: string; category?: PartnerCategory; subCategory?: CompanyActivity; order?: string },
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.createPartner({
      name: body.name,
      websiteUrl: body.websiteUrl,
      category: body.category || undefined,
      subCategory: body.subCategory || undefined,
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
    @Body() body: { name?: string; websiteUrl?: string; category?: PartnerCategory | ''; subCategory?: CompanyActivity | ''; order?: string; published?: string },
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.updatePartner(Number(id), {
      name: body.name,
      websiteUrl: body.websiteUrl,
      category: body.category !== undefined ? (body.category || null) : undefined,
      subCategory: body.subCategory !== undefined ? (body.subCategory || null) : undefined,
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

  @Get('admin/content/partner-applications')
  @UseGuards(JwtAuthGuard)
  async adminGetPartnerApplications(@Req() req: any, @Query('status') status?: PartnerApplicationStatus) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.getPartnerApplications(status);
  }

  @Put('admin/content/partner-applications/:id')
  @UseGuards(JwtAuthGuard)
  async reviewPartnerApplication(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED'; adminNote?: string },
  ) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.reviewPartnerApplication(Number(id), body.status, body.adminNote);
  }

  @Delete('admin/content/partner-applications/:id')
  @UseGuards(JwtAuthGuard)
  async deletePartnerApplication(@Req() req: any, @Param('id') id: string) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.deletePartnerApplication(Number(id));
  }

  @Get('admin/content/hero-slides')
  @UseGuards(JwtAuthGuard)
  async adminGetHeroSlides(@Req() req: any) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.getHeroSlides(false);
  }

  @Post('admin/content/hero-slides')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: './uploads/slides',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        return cb(null, `${randomName}${extname(file.originalname)}`);
      },
    }),
  }))
  async createHeroSlide(
    @Req() req: any,
    @Body() body: { categoryId?: string; title?: string; subtitle?: string; order?: string },
    @UploadedFile() image?: Express.Multer.File,
  ) {
    await this.adminService.checkAdmin(req.user.userId);
    if (!image) throw new BadRequestException('Image requise');
    return this.contentService.createHeroSlide({
      categoryId: body.categoryId || null,
      imageUrl: `/uploads/slides/${image.filename}`,
      title: body.title || null,
      subtitle: body.subtitle || null,
      order: body.order ? Number(body.order) : 0,
    });
  }

  @Put('admin/content/hero-slides/:id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: './uploads/slides',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        return cb(null, `${randomName}${extname(file.originalname)}`);
      },
    }),
  }))
  async updateHeroSlide(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { categoryId?: string; title?: string; subtitle?: string; order?: string; published?: string },
    @UploadedFile() image?: Express.Multer.File,
  ) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.updateHeroSlide(Number(id), {
      ...(body.categoryId !== undefined ? { categoryId: body.categoryId || null } : {}),
      ...(body.title !== undefined ? { title: body.title || null } : {}),
      ...(body.subtitle !== undefined ? { subtitle: body.subtitle || null } : {}),
      ...(body.order !== undefined ? { order: Number(body.order) } : {}),
      ...(body.published !== undefined ? { published: body.published === 'true' } : {}),
      ...(image ? { imageUrl: `/uploads/slides/${image.filename}` } : {}),
    });
  }

  @Delete('admin/content/hero-slides/:id')
  @UseGuards(JwtAuthGuard)
  async deleteHeroSlide(@Req() req: any, @Param('id') id: string) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.deleteHeroSlide(Number(id));
  }

  @Get('admin/content/useful-links')
  @UseGuards(JwtAuthGuard)
  async adminGetUsefulLinks(@Req() req: any) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.getUsefulLinks(false);
  }

  @Post('admin/content/useful-links')
  @UseGuards(JwtAuthGuard)
  async createUsefulLink(@Req() req: any, @Body() body: { title: string; url: string; order?: number }) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.createUsefulLink(body.title, body.url, body.order ?? 0);
  }

  @Put('admin/content/useful-links/:id')
  @UseGuards(JwtAuthGuard)
  async updateUsefulLink(@Req() req: any, @Param('id') id: string, @Body() body: { title?: string; url?: string; order?: number; published?: boolean }) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.updateUsefulLink(Number(id), body);
  }

  @Delete('admin/content/useful-links/:id')
  @UseGuards(JwtAuthGuard)
  async deleteUsefulLink(@Req() req: any, @Param('id') id: string) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.contentService.deleteUsefulLink(Number(id));
  }
}
