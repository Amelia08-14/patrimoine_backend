import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnnounceStatus, UserType } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async checkAdmin(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.userType !== UserType.ADMIN) {
        throw new UnauthorizedException('Access denied. Admin only.');
    }
    return user;
  }

  // --- Users Management ---

  async getAllUsers() {
    return this.prisma.user.findMany({
      where: {
        NOT: {
            userType: UserType.ADMIN
        }
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        companyName: true,
        commercialRegister: true,
        agreementNumber: true,
        rcDocumentUrl: true,
        agreementDocumentUrl: true,
        imageUrl: true,
        phone: true,
        createdAt: true,
        userType: true,
        adminVerified: true, // Important to show status
      },
    });
  }

  async getPendingUsers() {
    console.log("Fetching pending users...");
    const users = await this.prisma.user.findMany({
      where: {
        adminVerified: false,
        NOT: {
            userType: UserType.ADMIN
        }
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        companyName: true,
        commercialRegister: true,
        agreementNumber: true,
        rcDocumentUrl: true,
        agreementDocumentUrl: true,
        imageUrl: true,
        phone: true,
        createdAt: true,
        userType: true, // Make sure to select userType for debugging/frontend
      },
    });
    console.log(`Found ${users.length} pending users`);
    return users;
  }

  async validateUser(userId: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { adminVerified: true },
    });
  }

  async rejectUser(userId: number) {
    return this.prisma.user.delete({
      where: { id: userId },
    });
  }

  // --- Announces Management ---

  async getAllAnnounces() {
    return this.prisma.announce.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, companyName: true },
        },
        property: {
          include: {
            address: {
              include: { town: { include: { city: true } } },
            },
            images: true,
          },
        },
      },
    });
  }

  async getPendingAnnounces() {
    return this.prisma.announce.findMany({
      where: {
        status: AnnounceStatus.WAITING_VALIDATION,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, companyName: true },
        },
        property: {
          include: {
            address: {
              include: { town: { include: { city: true } } },
            },
            images: true,
          },
        },
      },
    });
  }

  async updateAnnounceStatus(announceId: number, status: AnnounceStatus) {
    return this.prisma.announce.update({
      where: { id: announceId },
      data: { status },
    });
  }
}
