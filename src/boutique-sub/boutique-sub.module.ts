import { Module } from '@nestjs/common';
import { BoutiqueSubService } from './boutique-sub.service';
import { BoutiqueSubController } from './boutique-sub.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BoutiqueSubController],
  providers: [BoutiqueSubService],
  exports: [BoutiqueSubService],
})
export class BoutiqueSubModule {}
