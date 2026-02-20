import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
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

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    AuthModule, AnnounceModule, UsersModule, AdminModule, ContactModule, EntrustedResearchModule, FavoriteModule, MessageModule
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
