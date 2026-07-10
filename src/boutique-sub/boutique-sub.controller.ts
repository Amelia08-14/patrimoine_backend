import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { BoutiqueSubService } from './boutique-sub.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('boutique-sub')
export class BoutiqueSubController {
  constructor(private readonly service: BoutiqueSubService) {}

  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  purchase(@Req() req: any, @Body('pack') pack: string) {
    return this.service.purchasePack(req.user.userId, pack);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  getMy(@Req() req: any) {
    return this.service.getUserSubscriptions(req.user.userId);
  }

  @Get('active')
  @UseGuards(JwtAuthGuard)
  getActive(@Req() req: any) {
    return this.service.getActiveSubscription(req.user.userId);
  }

  // Public: vérifie si un userId donné a une boutique active
  @Get('public/:userId/active')
  checkPublicActive(@Param('userId') userId: string) {
    return this.service.getActiveSubscription(Number(userId));
  }

  // ── ADMIN ──

  @Get('admin/all')
  @UseGuards(JwtAuthGuard)
  adminGetAll(@Query('status') status?: string) {
    return this.service.getAllSubscriptions(status);
  }

  @Put('admin/:id/validate')
  @UseGuards(JwtAuthGuard)
  adminValidate(@Param('id') id: string) {
    return this.service.validateSubscription(Number(id));
  }

  @Put('admin/:id/reject')
  @UseGuards(JwtAuthGuard)
  adminReject(@Param('id') id: string) {
    return this.service.rejectSubscription(Number(id));
  }
}
