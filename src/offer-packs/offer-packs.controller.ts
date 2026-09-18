import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminService } from '../admin/admin.service';
import { OfferPacksService } from './offer-packs.service';
import { OfferPackKind } from '@prisma/client';

@Controller()
export class OfferPacksController {
  constructor(
    private readonly offerPacksService: OfferPacksService,
    private readonly adminService: AdminService,
  ) {}

  // Public : consulté par les pages d'achat (points / boutique)
  @Get('offer-packs')
  findAll() {
    return this.offerPacksService.findAll();
  }

  @Post('admin/offer-packs')
  @UseGuards(JwtAuthGuard)
  async create(
    @Req() req: any,
    @Body() body: {
      kind: OfferPackKind; key: string;
      title: string; titleAr?: string | null; titleEn?: string | null;
      description?: string | null; descriptionAr?: string | null; descriptionEn?: string | null;
      price: number; points: number;
    },
  ) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.offerPacksService.create({
      kind: body.kind,
      key: body.key,
      title: body.title,
      titleAr: body.titleAr,
      titleEn: body.titleEn,
      description: body.description,
      descriptionAr: body.descriptionAr,
      descriptionEn: body.descriptionEn,
      price: Number(body.price),
      points: Number(body.points),
    });
  }

  @Put('admin/offer-packs/:id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: {
      title?: string; titleAr?: string | null; titleEn?: string | null;
      description?: string | null; descriptionAr?: string | null; descriptionEn?: string | null;
      price?: number; points?: number;
    },
  ) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.offerPacksService.update(Number(id), {
      title: body.title,
      titleAr: body.titleAr,
      titleEn: body.titleEn,
      description: body.description,
      descriptionAr: body.descriptionAr,
      descriptionEn: body.descriptionEn,
      price: body.price !== undefined ? Number(body.price) : undefined,
      points: body.points !== undefined ? Number(body.points) : undefined,
    });
  }

  @Delete('admin/offer-packs/:id')
  @UseGuards(JwtAuthGuard)
  async remove(@Req() req: any, @Param('id') id: string) {
    await this.adminService.checkAdmin(req.user.userId);
    return this.offerPacksService.remove(Number(id));
  }
}
