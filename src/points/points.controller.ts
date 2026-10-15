import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { PointsService } from './points.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const receiptStorage = diskStorage({
  destination: './uploads/documents',
  filename: (req, file, cb) => {
    const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
    return cb(null, `receipt-${randomName}${extname(file.originalname)}`);
  },
});

@Controller('points')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  getBalance(@Req() req: any) {
    return this.pointsService.getBalance(req.user.userId);
  }

  // Le reçu de paiement est optionnel à la commande (CCP/virement/BaridiMob peuvent être réglés
  // après coup) — cf. PUT purchases/:id/receipt pour l'ajouter/le remplacer ensuite.
  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('receipt', { storage: receiptStorage }))
  purchase(
    @Req() req: any,
    @Body('pack') pack: string,
    @Body('paymentMethod') paymentMethod: string,
    @UploadedFile() receipt?: Express.Multer.File,
  ) {
    const receiptUrl = receipt ? `/uploads/documents/${receipt.filename}` : undefined;
    return this.pointsService.purchasePack(req.user.userId, pack, paymentMethod, receiptUrl);
  }

  // Ajouter ou remplacer le reçu d'un achat en attente (PENDING) — pour l'utilisateur qui n'avait
  // pas encore payé/le reçu en main au moment de la commande.
  @Put('purchases/:id/receipt')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('receipt', { storage: receiptStorage }))
  uploadReceipt(@Req() req: any, @Param('id') id: string, @UploadedFile() receipt: Express.Multer.File) {
    const receiptUrl = receipt ? `/uploads/documents/${receipt.filename}` : undefined;
    return this.pointsService.setReceipt(req.user.userId, Number(id), receiptUrl);
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

  // Actualiser une recherche confiée (1 point)
  @Put('researches/:id/boost')
  @UseGuards(JwtAuthGuard)
  boostResearch(@Req() req: any, @Param('id') id: string) {
    return this.pointsService.boostResearch(req.user.userId, Number(id));
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
