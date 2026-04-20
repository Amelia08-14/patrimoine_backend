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
        transactionType, price, priceUnit, priceType, area, rooms,
        propertyType, amenities,
        landArea, builtArea, typology, floorCount, state,
        parkingCount, outdoorParking, usageType,
        buildingTypologyMode, buildingApartmentTypologyCustom, buildingTotalApartments, buildingSurfaceMode,
        buildingApartmentTypologies, buildingApartmentTypologyOther, buildingApartmentStyle,
        buildingCountF3, buildingCountF4, buildingCountF5,
        nbSuites, nbLivingRooms, nbBathrooms, bathroomType, nbToilets,
        kitchenType, kitchenState,
        heatingType, acType,
        waterCounter, elecCounter, gasCounter,
        depositMonths, rentalUsage, chargesIncluded, availableDate,
        habitableArea, bedrooms, bathrooms, wc, livingRooms,
        kitchenEquipment, exteriorFeatures, utilities, securityFeatures, connectivity,
        city, commune, address, mapsLink,
        contacts
    } = createAnnounceDto;

    const toFloat = (v: any): number | undefined => {
        if (v === null || v === undefined) return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
    };

    const toInt = (v: any): number | undefined => {
        const n = toFloat(v);
        if (n === undefined) return undefined;
        const i = Math.trunc(n);
        return Number.isFinite(i) ? i : undefined;
    };

    const parseJsonArray = (v?: string): string[] | undefined => {
        if (!v) return undefined;
        try {
            const parsed = JSON.parse(v);
            if (Array.isArray(parsed)) return parsed.map(x => String(x));
            return undefined;
        } catch {
            return undefined;
        }
    };
    
    const parseTypologyOther = (v?: string): string[] | undefined => {
        if (!v) return undefined;
        const parts = String(v)
            .split(/[,\s]+/)
            .map(x => x.trim())
            .filter(Boolean);
        return parts.length > 0 ? parts : undefined;
    };

    const computedArea =
        toFloat(area) ??
        toFloat(habitableArea) ??
        toFloat(builtArea) ??
        toFloat(landArea) ??
        0;

    const computedNbRooms = toInt(rooms) ?? toInt(bedrooms);
    const computedNbPieces = toInt(bedrooms);
    const computedNbLivingRooms = toInt(nbLivingRooms) ?? toInt(livingRooms);
    const computedNbBathrooms = toInt(nbBathrooms) ?? toInt(bathrooms);
    const computedNbToilets = toInt(nbToilets) ?? toInt(wc);

    let amenitiesValue: string | undefined = amenities || undefined;
    
    // Check if we need to merge existing amenities with new features
    let featuresPayload: any = {};
    if (amenitiesValue) {
        try {
            const existingAmenities = JSON.parse(amenitiesValue);
            if (typeof existingAmenities === 'object' && !Array.isArray(existingAmenities)) {
                featuresPayload = { ...existingAmenities };
            }
        } catch (e) {
            // Ignore if not a valid JSON object
        }
    }

    // Always merge in these specific arrays if they exist in the DTO
    if (kitchenEquipment) featuresPayload.kitchenEquipment = parseJsonArray(kitchenEquipment);
    if (exteriorFeatures) featuresPayload.exteriorFeatures = parseJsonArray(exteriorFeatures);
    if (utilities) featuresPayload.utilities = parseJsonArray(utilities);
    if (securityFeatures) featuresPayload.securityFeatures = parseJsonArray(securityFeatures);
    if (connectivity) featuresPayload.connectivity = parseJsonArray(connectivity);
    
    if (propertyType === 'IMMEUBLE_RESIDENTIEL' && buildingTypologyMode) {
        const selectedTypologies = parseJsonArray(buildingApartmentTypologies);
        const otherTypologies = parseTypologyOther(buildingApartmentTypologyOther);
        const normalizedSelected = selectedTypologies?.filter(t => t !== 'F10_PLUS');
        const counts: Record<string, number> = {};
        if (selectedTypologies?.includes('F3')) {
            const v = toInt(buildingCountF3);
            if (v !== undefined) counts.F3 = v;
        }
        if (selectedTypologies?.includes('F4')) {
            const v = toInt(buildingCountF4);
            if (v !== undefined) counts.F4 = v;
        }
        if (selectedTypologies?.includes('F5')) {
            const v = toInt(buildingCountF5);
            if (v !== undefined) counts.F5 = v;
        }
        
        featuresPayload.buildingTypology = {
            mode: buildingTypologyMode,
            apartmentTypology: buildingApartmentTypologyCustom ? `F${buildingApartmentTypologyCustom}` : undefined,
            apartmentTypologies: normalizedSelected,
            apartmentTypologiesOther: otherTypologies,
            apartmentStyle: parseJsonArray(buildingApartmentStyle),
            totalApartments: toInt(buildingTotalApartments),
            surfaceMode: buildingSurfaceMode,
            counts: Object.keys(counts).length > 0 ? counts : undefined,
        };
    }

    // Only stringify if there are actual features to save
    if (Object.values(featuresPayload).some(v => {
        if (!v) return false;
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === 'object') return Object.keys(v as any).length > 0;
        return true;
    })) {
        amenitiesValue = JSON.stringify(featuresPayload);
    }

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
        const hash = (value: string) => {
            let h = 5381;
            for (let i = 0; i < value.length; i++) {
                h = ((h << 5) + h) ^ value.charCodeAt(i);
            }
            return h >>> 0;
        };

        const baseCode = 1_000_000_000 + (hash(city) % 900_000_000);
        let nextCode = baseCode;
        let createdCity: any = null;

        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                createdCity = await this.prisma.city.create({
                    data: {
                        nameFr: city,
                        nameAr: city,
                        nameEn: city,
                        code: nextCode
                    }
                });
                break;
            } catch (e: any) {
                nextCode += 1;
                if (attempt === 4) throw e;
            }
        }

        cityId = createdCity.id;
    }

    try {
      const announce = await this.prisma.announce.create({
        data: {
          reference: `REF-${Date.now()}`,
          title: (createAnnounceDto as any).title || null,
          shortDescription: (createAnnounceDto as any).shortDescription || null,
          status: AnnounceStatus.WAITING_VALIDATION,
          type: transactionType as TransactionType,
          price: Number(price),
          priceUnit,
          priceType,
        userId: userId,
        property: {
          create: {
            amenities: amenitiesValue,
            area: computedArea,
            nbRooms: computedNbRooms,
            nbPieces: computedNbPieces,
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
            nbLivingRooms: computedNbLivingRooms,
            nbBathrooms: computedNbBathrooms,
            bathroomType,
            nbToilets: computedNbToilets,
            kitchenType,
            kitchenState,
            heatingType,
            acType,
            waterCounter,
            elecCounter,
            gasCounter,
            depositMonths: depositMonths ? Number(depositMonths) : undefined,
            rentalUsage,
            chargesIncluded: chargesIncluded === 'true' || (chargesIncluded as any) === true,
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
            address: {
              include: {
                town: {
                  select: {
                    id: true,
                    nameFr: true,
                    nameAr: true,
                    nameEn: true,
                    city: {
                      select: {
                        id: true,
                        nameFr: true,
                        nameAr: true,
                        nameEn: true,
                      },
                    },
                  },
                },
              },
            },
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
            address: {
              include: {
                town: {
                  select: {
                    id: true,
                    nameFr: true,
                    nameAr: true,
                    nameEn: true,
                    city: {
                      select: {
                        id: true,
                        nameFr: true,
                        nameAr: true,
                        nameEn: true,
                      },
                    },
                  },
                },
              },
            },
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
