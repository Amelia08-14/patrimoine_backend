import { IsString, IsNotEmpty, IsOptional, IsEnum, ValidateIf } from 'class-validator';
import { TransactionType } from '@prisma/client';
import { Transform } from 'class-transformer';

export class CreateAnnounceDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  shortDescription?: string;

  @IsEnum(TransactionType)
  @IsNotEmpty()
  transactionType: string;

  @IsString()
  @IsNotEmpty()
  propertyType: string;

  @ValidateIf((o) => !(['USINE', 'CHAMBRE_FROIDE', 'HANGAR'].includes(o.propertyType) && o.transactionType === 'RENTAL'))
  @IsString()
  @IsNotEmpty()
  city?: string;

  @IsString()
  @IsOptional()
  commune?: string;

  @ValidateIf((o) => !(['USINE', 'CHAMBRE_FROIDE', 'HANGAR'].includes(o.propertyType) && o.transactionType === 'RENTAL'))
  @IsString()
  @IsNotEmpty()
  address?: string;

  @IsString()
  @IsOptional()
  mapsLink?: string;

  @IsString()
  @IsOptional()
  area?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @ValidateIf((o) => !(['USINE', 'CHAMBRE_FROIDE', 'HANGAR'].includes(o.propertyType) && o.transactionType === 'RENTAL'))
  @IsString()
  @IsNotEmpty()
  price?: string;

  @IsString()
  @IsOptional()
  priceUnit?: string;

  @IsString()
  @IsOptional()
  priceType?: string;

  @IsString()
  @IsOptional() // Can be optional if villa
  rooms?: string;

  @IsString()
  @IsOptional()
  habitableArea?: string;

  @IsString()
  @IsOptional()
  bedrooms?: string;

  @IsString()
  @IsOptional()
  bathrooms?: string;

  @IsString()
  @IsOptional()
  wc?: string;

  @IsString()
  @IsOptional()
  livingRooms?: string;

  @IsString()
  @IsOptional()
  amenities?: string;

  @IsString()
  @IsOptional()
  kitchenEquipment?: string;

  @IsString()
  @IsOptional()
  exteriorFeatures?: string;

  @IsString()
  @IsOptional()
  utilities?: string;

  @IsString()
  @IsOptional()
  securityFeatures?: string;

  @IsString()
  @IsOptional()
  connectivity?: string;

  // --- New Fields for Villa Rental ---
  
  @IsString() @IsOptional() landArea?: string;
  @IsString() @IsOptional() builtArea?: string;
  @IsString() @IsOptional() typology?: string;
  @IsString() @IsOptional() configuration?: string;
  @IsString() @IsOptional() floorCount?: string;
  @IsString() @IsOptional() state?: string;
  @IsString() @IsOptional() facadesCount?: string;
  
  @IsString() @IsOptional() parkingCount?: string;
  @IsString() @IsOptional() outdoorParking?: string;

  @IsString() @IsOptional() usageType?: string;

  @IsString() @IsOptional() buildingTypologyMode?: string;
  @IsString() @IsOptional() buildingApartmentTypologyCustom?: string;
  @IsString() @IsOptional() buildingTotalApartments?: string;
  @IsString() @IsOptional() buildingSurfaceMode?: string;
  @IsString() @IsOptional() buildingApartmentTypologies?: string;
  @IsString() @IsOptional() buildingApartmentTypologyOther?: string;
  @IsString() @IsOptional() buildingApartmentStyle?: string;
  @IsString() @IsOptional() buildingCountF3?: string;
  @IsString() @IsOptional() buildingCountF4?: string;
  @IsString() @IsOptional() buildingCountF5?: string;

  @IsString() @IsOptional() nbSuites?: string;
  @IsString() @IsOptional() nbLivingRooms?: string;
  @IsString() @IsOptional() nbBathrooms?: string;
  @IsString() @IsOptional() bathroomType?: string;
  @IsString() @IsOptional() nbToilets?: string;

  @IsString() @IsOptional() kitchenType?: string;
  @IsString() @IsOptional() kitchenState?: string;

  @IsString() @IsOptional() heatingType?: string;
  @IsString() @IsOptional() acType?: string;

  @IsString() @IsOptional() waterCounter?: string;
  @IsString() @IsOptional() elecCounter?: string;
  @IsString() @IsOptional() gasCounter?: string;

  @IsString() @IsOptional() depositMonths?: string;
  @IsString() @IsOptional() rentalUsage?: string;
  @IsString() @IsOptional() chargesIncluded?: string;
  @IsString() @IsOptional() availableDate?: string;

  @IsString() @IsOptional() acceptsBankCredit?: string;
  @IsString() @IsOptional() acceptsCrossUsage?: string;
  @IsString() @IsOptional() legalDocuments?: string;

  @IsString() @IsOptional() contacts?: string; // JSON String

  @IsString() @IsOptional() imagesMetadata?: string; // JSON String

  @IsOptional()
  userId?: string;
}
