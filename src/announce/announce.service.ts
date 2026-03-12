import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnounceDto } from './dto/create-announce.dto';
import { AnnounceStatus, TransactionType } from '@prisma/client';

@Injectable()
export class AnnounceService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, createAnnounceDto: CreateAnnounceDto, files: Array<Express.Multer.File>) {
    const { imagesMetadata } = createAnnounceDto;

    // Parse image metadata
    let categoryMap: Record<string, string> = {};
    let mainImageMap: Record<string, boolean> = {};
    let metadataArray: any[] = [];

    if (imagesMetadata) {
        try {
            const meta = JSON.parse(imagesMetadata);
            if (Array.isArray(meta)) {
                metadataArray = meta;
                meta.forEach((item: any) => {
                    if (item.filename) {
                        if (item.category) categoryMap[item.filename] = item.category;
                        if (item.isMain) mainImageMap[item.filename] = true;
                    }
                });
            }
        } catch (e) {
            console.error("Failed to parse imagesMetadata", e);
        }
    }

    const {
        transactionType, price, priceUnit, priceType, area, rooms, description,
        propertyType, amenities,
        landArea, builtArea, typology, floorCount, state,
        parkingCount, outdoorParking, usageType,
        nbSuites, nbLivingRooms, nbBathrooms, nbToilets,
        kitchenType, kitchenState,
        heatingType, acType,
        waterCounter, elecCounter, gasCounter,
        depositMonths, rentalUsage, chargesIncluded, availableDate,
        city, commune, address, mapsLink,
        contacts
    } = createAnnounceDto;

    // Separate images and videos
    const imageFiles = files.filter(file => !file.mimetype.startsWith('video/'));
    const videoFiles = files.filter(file => file.mimetype.startsWith('video/'));
    const videoPaths = videoFiles.map(file => file.path.replace(/\\/g, '/'));

    // Création de l'annonce avec Prisma
    console.log("FULL DTO RECEIVED:", JSON.stringify(createAnnounceDto));
    console.log("Creating announce with data:", { transactionType, price, userId, status: AnnounceStatus.WAITING_VALIDATION });
    
    if (!transactionType) {
        throw new Error("Transaction Type is missing from DTO");
    }

    // Handle City creation/connection manually to avoid unique constraint issues
    let cityId: number;
    const existingCity = await this.prisma.city.findFirst({
        where: { nameFr: city }
    });

    if (existingCity) {
        cityId = existingCity.id;
    } else {
        const newCity = await this.prisma.city.create({
            data: {
                nameFr: city,
                nameAr: city,
                nameEn: city,
                code: 16000 // Default code
            }
        });
        cityId = newCity.id;
    }

    try {
      const announce = await this.prisma.announce.create({
        data: {
          reference: `REF-${Date.now()}`,
          status: AnnounceStatus.WAITING_VALIDATION,
          type: transactionType as TransactionType,
          price: Number(price),
          priceUnit,
          priceType,
        userId: userId,
        property: {
          create: {
            description: description || null,
            amenities: amenities ? amenities : undefined,
            area: Number(area),
            nbRooms: Number(rooms),
            propertyType,
            // Mapping new fields
            landArea: landArea ? Number(landArea) : undefined,
            builtArea: builtArea ? Number(builtArea) : undefined,
            typology,
            nbFloors: floorCount ? Number(floorCount) : undefined, // Assuming floorCount maps to nbFloors
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
            availableDate: availableDate ? new Date(availableDate) : undefined,
            contacts, // Added contacts
            mapsLink,
            commune,
            videos: JSON.stringify(videoPaths),
            address: {
              create: {
                street: address,
                town: {
                  create: {
                    nameFr: commune || city, // Use commune if available, fallback to city
                    nameAr: commune || city,
                    nameEn: commune || city,
                    city: {
                      connect: { id: cityId }
                    }
                  }
                }
              }
            },
            images: {
              create: imageFiles.map((file, index) => {
                // Determine category and main image status
                let category = 'general';
                let isMain = false;

                if (metadataArray[index]) {
                    if (metadataArray[index].category) category = metadataArray[index].category;
                    if (metadataArray[index].isMain) isMain = true;
                } else {
                    // Fallback to filename matching
                    if (categoryMap[file.originalname]) category = categoryMap[file.originalname];
                    if (mainImageMap[file.originalname]) isMain = true;
                }

                return {
                    url: file.path.replace(/\\/g, '/'),
                    contentType: file.mimetype,
                    category: category,
                    isMain: isMain
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
