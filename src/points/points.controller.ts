import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { PointsService } from './points.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('points')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  getBalance(@Req() req: any) {
    return this.pointsService.getBalance(req.user.userId);
  }

  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  purchase(@Req() req: any, @Body('pack') pack: string) {
    return this.pointsService.purchasePack(req.user.userId, pack);
  }

  @Get('purchases')
  @UseGuards(JwtAuthGuard)
  getPurchases(@Req() req: any) {
    return this.pointsService.getUserPurchases(req.user.userId);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  getHistory(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.pointsService.getUserHistory(req.user.userId, from, to);
  }

  // Actualiser une annonce (1 point)
  @Put('announces/:id/boost')
  @UseGuards(JwtAuthGuard)
  boost(@Req() req: any, @Param('id') id: string) {
    return this.pointsService.boostAnnounce(req.user.userId, Number(id));
  }

  // Mettre en publicité (2 pts/jour)
  @Post('announces/:id/feature')
  @UseGuards(JwtAuthGuard)
  feature(
    @Req() req: any,
    @Param('id') id: string,
    @Body('days') days: number,
    @Body('startDate') startDate: string
  ) {
    return this.pointsService.featureAnnounce(req.user.userId, Number(id), Number(days), new Date(startDate));
  }

  // ── ADMIN ──
  @Get('admin/purchases')
  @UseGuards(JwtAuthGuard)
  adminGetPurchases(@Query('status') status?: string) {
    return this.pointsService.getAllPurchases(status);
  }

  @Put('admin/purchases/:id/validate')
  @UseGuards(JwtAuthGuard)
  adminValidate(@Param('id') id: string) {
    return this.pointsService.validatePurchase(Number(id));
  }

  @Put('admin/purchases/:id/reject')
  @UseGuards(JwtAuthGuard)
  adminReject(@Param('id') id: string) {
    return this.pointsService.rejectPurchase(Number(id));
  }
}
