import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnounceDto } from './dto/create-announce.dto';
import { AnnounceStatus, TransactionType } from '@prisma/client';

@Injectable()
export class AnnounceService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, createAnnounceDto: CreateAnnounceDto, files: Array<Express.Multer.File>) {
    const { 
      transactionType, 
      propertyType, 
      city, 
      address, 
      area, 
      price, 
      rooms, 
      description,
      amenities
    } = createAnnounceDto;

    // Création de l'annonce avec Prisma
    console.log("FULL DTO RECEIVED:", JSON.stringify(createAnnounceDto));
    console.log("Creating announce with data:", { transactionType, price, userId, status: AnnounceStatus.WAITING_VALIDATION });
    
    if (!transactionType) {
        throw new Error("Transaction Type is missing from DTO");
    }

    try {
      const announce = await this.prisma.announce.create({
        data: {
          reference: `REF-${Date.now()}`,
          status: AnnounceStatus.WAITING_VALIDATION,
          type: transactionType as TransactionType,
          price: Number(price),
        userId: userId,
        property: {
          create: {
            description,
            amenities: amenities ? amenities : undefined,
            area: Number(area),
            nbRooms: Number(rooms),
            propertyType,
            address: {
              create: {
                street: address,
                town: {
                  create: {
                    nameFr: city,
                    nameAr: city,
                    nameEn: city,
                    city: {
                      create: {
                        nameFr: city,
                        nameAr: city,
                        nameEn: city,
                        code: 16000 // Code par défaut temporaire
                      }
                    }
                  }
                }
              }
            },
            images: {
              create: files.map(file => ({
                url: file.path.replace(/\\/g, '/'), // Ensure forward slashes for URLs
                contentType: file.mimetype
              }))
            }
          }
        }
      },
      include: {
        property: {
          include: {
            images: true
          }
        }
      }
    });
    
    console.log("Announce created successfully:", announce.id);
    return announce;
    } catch (error) {
        console.error("Error creating announce:", error);
        throw error;
    }
  }

  async findAll() {
    return this.prisma.announce.findMany({
      where: { status: AnnounceStatus.VALIDATED },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            companyName: true,
            imageUrl: true,
            userType: true
          }
        },
        property: {
          include: {
            images: true,
            address: { include: { town: { include: { city: true } } } }
          }
        }
      }
    });
  }

  async findOne(id: number) {
    // Increment view count
    await this.prisma.announce.update({
        where: { id },
        data: { nbViews: { increment: 1 } }
    });

    return this.prisma.announce.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true, imageUrl: true, userType: true } },
        property: {
          include: {
            images: true,
            address: { include: { town: { include: { city: true } } } }
          }
        }
      }
    });
  }

  async findByUser(userId: number) {
    return this.prisma.announce.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        property: {
          include: {
            images: true,
          }
        }
      }
    });
  }
}
