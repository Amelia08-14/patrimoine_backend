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
  async completeProfile(
    @Req() req: any, 
    @Body() data: any,
    @UploadedFiles() files: { rcDocument?: Express.Multer.File[], agreementDocument?: Express.Multer.File[], agencyLogo?: Express.Multer.File[] }
  ) {
    const { 
        civility, firstName, lastName, dateOfBirth, 
        phone, landline, address, townId, wilaya, commune,
        commercialRegister, agreementNumber, companyName
    } = data;

    // Construct full address if wilaya/commune provided and no townId
    let fullAddress = address;
    if (commune && wilaya) {
        fullAddress = `${address}, ${commune}, Wilaya ${wilaya}`;
    }
    
    // Handle File URLs
    const rcDocumentUrl = files?.rcDocument ? `/uploads/documents/${files.rcDocument[0].filename}` : undefined;
    const agreementDocumentUrl = files?.agreementDocument ? `/uploads/documents/${files.agreementDocument[0].filename}` : undefined;
    // We could handle agencyLogo here if we added a field for it, e.g. imageUrl or a specific logoUrl field.
    // For now, let's assume imageUrl could be used for the logo or we add a new field. 
    // The prompt only asked for RC and Agreement uploads explicitly, but the screenshot shows "Logo de l'agence".
    // I'll check if imageUrl is free. Schema says `imageUrl String?`. I'll use that for the logo.
    const logoUrl = files?.agencyLogo ? `/uploads/documents/${files.agencyLogo[0].filename}` : undefined;

    return this.prisma.user.update({
      where: { id: req.user.userId },
      data: {
        civility,
        firstName,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        phone,
        landline,
        address: fullAddress,
        townId: townId ? Number(townId) : undefined,
        // Champs Société
        commercialRegister,
        agreementNumber,
        companyName,
        
        // Update documents if provided
        ...(rcDocumentUrl && { rcDocumentUrl }),
        ...(agreementDocumentUrl && { agreementDocumentUrl }),
        ...(logoUrl && { imageUrl: logoUrl }),
      },
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
