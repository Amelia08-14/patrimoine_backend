import { Module } from '@nestjs/common';
import { OfferPacksService } from './offer-packs.service';
import { OfferPacksController } from './offer-packs.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [PrismaModule, AdminModule],
  controllers: [OfferPacksController],
  providers: [OfferPacksService],
  exports: [OfferPacksService],
})
export class OfferPacksModule {}
