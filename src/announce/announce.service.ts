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
      amenities,
      // New fields
      landArea, builtArea, typology, configuration, state,
      parkingCount, outdoorParking,
      usageType,
      nbSuites, nbLivingRooms, nbBathrooms, nbToilets,
      kitchenType, kitchenState,
      heatingType, acType,
      waterCounter, elecCounter, gasCounter,
      depositMonths, rentalUsage, chargesIncluded,
      imagesMetadata
    } = createAnnounceDto;

    // Parse image metadata
    let categoryMap: Record<string, string> = {};
    let metadataArray: any[] = [];

    if (imagesMetadata) {
        try {
            const meta = JSON.parse(imagesMetadata);
            if (Array.isArray(meta)) {
                metadataArray = meta;
                meta.forEach((item: any) => {
                    if (item.filename && item.category) {
                        categoryMap[item.filename] = item.category;
                    }
                });
            }
        } catch (e) {
            console.error("Failed to parse imagesMetadata", e);
        }
    }

    // Création de l'annonce avec Prisma
    console.log("FULL DTO RECEIVED:", JSON.stringify(createAnnounceDto));
    console.log("Creating announce with data:", { transactionType, price, userId, status: AnnounceStatus.VALIDATED });
    
    if (!transactionType) {
        throw new Error("Transaction Type is missing from DTO");
    }

    try {
      const announce = await this.prisma.announce.create({
        data: {
          reference: `REF-${Date.now()}`,
          status: AnnounceStatus.VALIDATED,
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
            // Mapping new fields
            landArea: landArea ? Number(landArea) : undefined,
            builtArea: builtArea ? Number(builtArea) : undefined,
            typology,
            configuration,
            state,
            parkingCount: parkingCount ? Number(parkingCount) : undefined,
            outdoorParking: outdoorParking ? Number(outdoorParking) : undefined,
            usageType,
            nbSuites: nbSuites ? Number(nbSuites) : undefined,
            nbLivingRooms: nbLivingRooms ? Number(nbLivingRooms) : undefined,
            nbBathrooms: nbBathrooms ? Number(nbBathrooms) : undefined,
            nbToilets: nbToilets ? Number(nbToilets) : undefined,
            kitchenType,
            kitchenState,
            heatingType,
            acType,
            waterCounter,
            elecCounter,
            gasCounter,
            depositMonths: depositMonths ? Number(depositMonths) : undefined,
            rentalUsage,
            chargesIncluded: chargesIncluded === 'true',
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
              create: files.map((file, index) => {
                // Determine category: Priority to index-based matching (since order is preserved), 
                // then filename matching, then default to 'general'
                let category = 'general';
                if (metadataArray[index] && metadataArray[index].category) {
                    category = metadataArray[index].category;
                } else if (categoryMap[file.originalname]) {
                    category = categoryMap[file.originalname];
                }

                return {
                    url: file.path.replace(/\\/g, '/'),
                    contentType: file.mimetype,
                    category: category
                };
              })
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
