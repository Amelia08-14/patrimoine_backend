import { Controller, Post, Get, Body, Param, UseInterceptors, UploadedFiles, UseGuards, Req, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { AnnounceService } from './announce.service';
import { CreateAnnounceDto } from './dto/create-announce.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('announces')
export class AnnounceController {
  constructor(
    private readonly announceService: AnnounceService,
    private readonly prisma: PrismaService
  ) {}

  @Get()
  async findAll() {
    return this.announceService.findAll();
  }

  @Get('user/my-announces')
  @UseGuards(JwtAuthGuard)
  async findMyAnnounces(@Req() req: any) {
    return this.announceService.findByUser(req.user.userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const announce = await this.announceService.findOne(Number(id));
    if (!announce) throw new NotFoundException('Annonce non trouvée');
    return announce;
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FilesInterceptor('images', 10, {
    storage: diskStorage({
      destination: './uploads',
      filename: (req: any, file: any, callback: any) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      },
    }),
  }))
  async create(@Body() createAnnounceDto: CreateAnnounceDto, @UploadedFiles() files: Array<Express.Multer.File>, @Req() req: any) {
    // Check if user is validated
    const user = await this.prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user || !user.adminVerified) {
        throw new UnauthorizedException("Votre compte doit être validé par un administrateur pour poster des annonces.");
    }

    return this.announceService.create(req.user.userId, createAnnounceDto, files);
  }
}
