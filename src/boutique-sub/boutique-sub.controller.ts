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

  // ── Abonnés à la boutique (bouton "S'abonner" public) ──

  @Post('follow/:ownerId')
  @UseGuards(JwtAuthGuard)
  follow(@Req() req: any, @Param('ownerId') ownerId: string) {
    return this.service.followBoutique(req.user.userId, Number(ownerId));
  }

  @Post('unfollow/:ownerId')
  @UseGuards(JwtAuthGuard)
  unfollow(@Req() req: any, @Param('ownerId') ownerId: string) {
    return this.service.unfollowBoutique(req.user.userId, Number(ownerId));
  }

  // Public : compteur d'abonnés (+ statut si connecté, via un token optionnel côté frontend)
  @Get('follow/:ownerId/status')
  followStatus(@Param('ownerId') ownerId: string, @Query('followerId') followerId?: string) {
    return this.service.getBoutiqueFollowStatus(Number(ownerId), followerId ? Number(followerId) : undefined);
  }

  // Le pro consulte la liste de ses abonnés (statistiques)
  @Get('followers/mine')
  @UseGuards(JwtAuthGuard)
  myFollowers(@Req() req: any) {
    return this.service.getBoutiqueFollowers(req.user.userId);
  }

  // Clic sur un bouton de contact affiché directement sur la boutique publique — public,
  // aucune connexion requise pour contacter un pro.
  @Post(':ownerId/contact')
  trackBoutiqueContact(@Param('ownerId') ownerId: string, @Body('channel') channel: string) {
    return this.service.trackBoutiqueContact(Number(ownerId), channel);
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
