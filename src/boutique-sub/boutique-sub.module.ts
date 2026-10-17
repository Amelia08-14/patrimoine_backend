import { Module } from '@nestjs/common';
import { BoutiqueSubService } from './boutique-sub.service';
import { BoutiqueSubController } from './boutique-sub.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [BoutiqueSubController],
  providers: [BoutiqueSubService],
  exports: [BoutiqueSubService],
})
export class BoutiqueSubModule {}
