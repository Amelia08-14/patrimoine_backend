import { Controller, Get, Req, UseGuards, Put, Body, NotFoundException, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Req() req: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        points: true,
        announces: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = user;
    return result;
  }

  // Fusion de la logique d'update complète
  @UseGuards(JwtAuthGuard)
  @Put('profile')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'rcDocument', maxCount: 1 },
    { name: 'agreementDocument', maxCount: 1 },
    { name: 'agencyLogo', maxCount: 1 },
  ], {
    storage: diskStorage({
      destination: './uploads/documents',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        return cb(null, `${randomName}${extname(file.originalname)}`);
      }
    })
  }))
  async updateFullProfile(
    @Req() req: any,
    @Body() body: any,
    @UploadedFiles() files: {
      rcDocument?: Express.Multer.File[];
      agreementDocument?: Express.Multer.File[];
      agencyLogo?: Express.Multer.File[];
    },
  ) {
    const userId = req.user.userId;
    
    let rcDocumentUrl = undefined;
    let agreementDocumentUrl = undefined;
    let logoUrl = undefined;

    if (files?.rcDocument?.[0]) {
      rcDocumentUrl = `/uploads/documents/${files.rcDocument[0].filename}`;
    }
    if (files?.agreementDocument?.[0]) {
      agreementDocumentUrl = `/uploads/documents/${files.agreementDocument[0].filename}`;
    }
    if (files?.agencyLogo?.[0]) {
      logoUrl = `/uploads/documents/${files.agencyLogo[0].filename}`;
    }

    // Si le mot de passe est fourni, on le hash (pour la page info)
    let passwordHash = undefined;
    if (body.newPassword) {
      const bcrypt = require('bcrypt');
      passwordHash = await bcrypt.hash(body.newPassword, 10);
    }

    // Construct full address if wilaya/commune provided and no townId (pour la page complete)
    let fullAddress = body.address;
    if (body.commune && body.wilaya) {
        fullAddress = `${body.address}, ${body.commune}, Wilaya ${body.wilaya}`;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        civility: body.civility,
        firstName: body.firstName,
        lastName: body.lastName,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
        phone: body.phone,
        landline: body.landline,
        address: fullAddress,
        townId: body.townId ? Number(body.townId) : undefined,
        companyName: body.companyName,
        commercialRegister: body.commercialRegister,
        position: body.position,
        ...(passwordHash && { passwordHash }),
        ...(rcDocumentUrl && { rcDocumentUrl }),
        ...(agreementDocumentUrl && { agreementDocumentUrl }),
        ...(logoUrl && { agencyLogoUrl: logoUrl }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        userType: true,
        companyName: true,
        companyActivity: true,
        agencyLogoUrl: true,
        phone: true,
        address: true,
        position: true,
        rcDocumentUrl: true,
        agreementDocumentUrl: true
      }
    });
  }

  @UseGuards(JwtAuthGuard)
  @Put('me')
  async updateProfile(@Req() req: any, @Body() data: { firstName?: string; lastName?: string }) {
    return this.prisma.user.update({
      where: { id: req.user.userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
      },
    });
  }
}
