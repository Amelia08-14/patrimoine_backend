import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnounceDto } from './dto/create-announce.dto';
import { AnnounceStatus, TransactionType, ContactChannel } from '@prisma/client';

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
        facadesCount, acceptsBankCredit, legalDocuments,
        parkingCount, outdoorParking, usageType, acceptsCrossUsage, cadreModeVie, buildingUsageTypes,
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

    const cleanNumberLike = (v: any) => {
        if (v === null || v === undefined) return undefined;
        if (typeof v === 'string') {
            const s = v.trim().replace(/\s/g, '');
            return s.length ? s : undefined;
        }
        return v;
    };

    const computedPrice = toFloat(cleanNumberLike(price)) ?? 0;

    const cleanStringOrNull = (v?: string) => {
        const s = typeof v === 'string' ? v.trim() : '';
        return s.length ? s : null;
    };

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
    // Cadre et mode de vie (Quartier classique / Résidence clôturée / Promotion immobilière) — choix multiple,
    // commun à tous les types de biens d'habitation (pas seulement l'Immeuble comme auparavant).
    if (buildingUsageTypes) featuresPayload.buildingUsageTypes = parseJsonArray(buildingUsageTypes);
    
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

    const normalizedCity = typeof city === 'string' ? city.trim() : '';
    const normalizedAddress = typeof address === 'string' ? address.trim() : '';
    const normalizedCommune = typeof commune === 'string' ? commune.trim() : '';

    let cityId: number | undefined;
    if (normalizedCity.length > 0) {
        const existingCity = await this.prisma.city.findFirst({
            where: { nameFr: normalizedCity }
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

            const baseCode = 1_000_000_000 + (hash(normalizedCity) % 900_000_000);
            let nextCode = baseCode;
            let createdCity: any = null;

            for (let attempt = 0; attempt < 5; attempt++) {
                try {
                    createdCity = await this.prisma.city.create({
                        data: {
                            nameFr: normalizedCity,
                            nameAr: normalizedCity,
                            nameEn: normalizedCity,
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
    }

    const shouldCreateAddress = normalizedAddress.length > 0 && cityId !== undefined;

    try {
      const announce = await this.prisma.announce.create({
        data: {
          reference: `REF-${Date.now()}`,
          title: (createAnnounceDto as any).title || null,
          shortDescription: (createAnnounceDto as any).shortDescription || null,
          status: AnnounceStatus.WAITING_VALIDATION,
          type: transactionType as TransactionType,
          price: computedPrice,
          priceUnit: cleanStringOrNull(priceUnit),
          priceType: cleanStringOrNull(priceType),
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
            facadesCount: toInt(facadesCount),
            acceptsBankCredit,
            legalDocuments,
            parkingCount: parkingCount ? Number(parkingCount) : undefined,
            outdoorParking: outdoorParking ? Number(outdoorParking) : undefined,
            usageType,
            cadreModeVie,
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
            acceptsCrossUsage: acceptsCrossUsage === 'true' || (acceptsCrossUsage as any) === true,
            crossRealEstateType: (() => {
                const isCross = acceptsCrossUsage === 'true' || (acceptsCrossUsage as any) === true;
                if (!isCross) return undefined;
                const RESIDENTIAL = ['VILLA','NIVEAU_VILLA','APPARTEMENT','DUPLEX','TRIPLEX','STUDIO','IMMEUBLE_RESIDENTIEL'];
                const COMMERCIAL = ['VILLA_COMMERCIALE','NIVEAU_VILLA_COMMERCIAL','APPARTEMENT_COMMERCIAL','IMMEUBLE_BUREAU'];
                if (RESIDENTIAL.includes(propertyType)) return 'BUREAUX_COMMERCES';
                if (COMMERCIAL.includes(propertyType)) return 'RESIDENTIEL';
                return undefined;
            })(),
            availableDate: availableDate ? new Date(availableDate) : undefined,
            contacts, // Added contacts
            mapsLink,
            commune,
            videos: JSON.stringify(videoPaths),
            address: shouldCreateAddress ? {
              create: {
                street: normalizedAddress,
                town: {
                  create: {
                    nameFr: normalizedCommune || normalizedCity,
                    nameAr: normalizedCommune || normalizedCity,
                    nameEn: normalizedCommune || normalizedCity,
                    city: {
                      connect: { id: cityId }
                    }
                  }
                }
              }
            } : undefined,
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
      orderBy: [
        { refreshDate: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' }
      ],
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

  async incrementCalls(id: number) {
    return this.prisma.announce.update({
      where: { id },
      data: { nbCalls: { increment: 1 } },
      select: { id: true, nbCalls: true },
    });
  }

  // Suivi détaillé par canal (appel/whatsapp/telegram/viber/email) — matière première de
  // "Mes statistiques". Garde aussi nbCalls à jour pour les usages existants sur ce compteur.
  async trackContactClick(announceId: number, channel: string) {
    const validChannels = Object.values(ContactChannel);
    if (!validChannels.includes(channel as ContactChannel)) {
      throw new BadRequestException('Canal de contact invalide');
    }
    const announce = await this.prisma.announce.findUnique({ where: { id: announceId }, select: { userId: true } });
    if (!announce) throw new NotFoundException('Annonce introuvable');

    const [click] = await this.prisma.$transaction([
      this.prisma.contactClick.create({
        data: { announceId, ownerId: announce.userId, channel: channel as ContactChannel },
      }),
      ...(channel === 'CALL' ? [this.prisma.announce.update({ where: { id: announceId }, data: { nbCalls: { increment: 1 } } })] : []),
    ]);
    return { success: true, id: click.id };
  }

  async reportAnnounce(announceId: number, reason: string, message: string | undefined, reporterId: number | undefined) {
    if (!reason) throw new BadRequestException('Motif du signalement requis');
    const announce = await this.prisma.announce.findUnique({ where: { id: announceId }, select: { userId: true } });
    if (!announce) throw new NotFoundException('Annonce introuvable');

    return this.prisma.report.create({
      data: { announceId, ownerId: announce.userId, reason, message, reporterId },
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
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true, imageUrl: true, agencyLogoUrl: true, userType: true } },
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
    const announces = await this.prisma.announce.findMany({
      where: { userId },
      orderBy: [
        { refreshDate: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' }
      ],
      include: {
        property: {
          include: {
            images: true,
            address: { include: { town: { include: { city: true } } } },
          }
        },
        pointUsages: { select: { pointsUsed: true, action: true, usageDate: true } },
      }
    });

    // Agrégats points par annonce (nombre de consommations + total dépensé), utilisés par le
    // tableau "Mes Annonces" — filtres et KPI de positionnement du client.
    return announces.map((a) => ({
      ...a,
      pointsUsageCount: a.pointUsages.length,
      pointsUsageTotal: a.pointUsages.reduce((sum, u) => sum + u.pointsUsed, 0),
    }));
  }

  async findByUserPublic(userId: number) {
    return this.prisma.announce.findMany({
      where: { userId, status: AnnounceStatus.VALIDATED },
      orderBy: [
        { refreshDate: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' }
      ],
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
            userType: true,
            agencyLogoUrl: true,
            phone: true,
          }
        },
        property: {
          include: {
            images: true,
            address: {
              include: {
                town: {
                  include: { city: true }
                }
              }
            }
          }
        }
      }
    });
  }
}
