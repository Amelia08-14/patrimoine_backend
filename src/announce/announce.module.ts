import { Module } from '@nestjs/common';
import { AnnounceService } from './announce.service';
import { AnnounceController } from './announce.controller';
import { TitleTranslationService } from './title-translation.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AnnounceController],
  providers: [AnnounceService, TitleTranslationService],
  exports: [TitleTranslationService],
})
export class AnnounceModule {}
