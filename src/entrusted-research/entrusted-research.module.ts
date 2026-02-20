import { Module } from '@nestjs/common';
import { EntrustedResearchService } from './entrusted-research.service';
import { EntrustedResearchController } from './entrusted-research.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EntrustedResearchController],
  providers: [EntrustedResearchService],
})
export class EntrustedResearchModule {}
