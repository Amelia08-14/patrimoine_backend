import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminModule } from '../admin/admin.module';
import { AdsService } from './ads.service';
import { AdsController } from './ads.controller';

@Module({
  imports: [PrismaModule, AdminModule],
  controllers: [AdsController],
  providers: [AdsService],
})
export class AdsModule {}
