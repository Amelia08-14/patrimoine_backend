import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma/prisma.service';
import { AnnounceModule } from './announce/announce.module';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';
import { ContactModule } from './contact/contact.module';
import { EntrustedResearchModule } from './entrusted-research/entrusted-research.module';
import { FavoriteModule } from './favorite/favorite.module';
import { MessageModule } from './message/message.module';
import { LocationModule } from './location/location.module';
import { PointsModule } from './points/points.module';
import { BoutiqueSubModule } from './boutique-sub/boutique-sub.module';
import { ContentModule } from './content/content.module';
import { OfferPacksModule } from './offer-packs/offer-packs.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    AnnounceModule,
    UsersModule,
    AdminModule,
    ContactModule,
    EntrustedResearchModule,
    FavoriteModule,
    MessageModule,
    LocationModule,
    PointsModule,
    BoutiqueSubModule,
    ContentModule,
    OfferPacksModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
