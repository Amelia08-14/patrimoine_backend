import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { TransactionType } from '@prisma/client';

export class CreateAnnounceDto {
  @IsEnum(TransactionType)
  @IsNotEmpty()
  transactionType: string;

  @IsString()
  @IsNotEmpty()
  propertyType: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsOptional()
  commune?: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsOptional()
  mapsLink?: string;

  @IsString()
  @IsNotEmpty()
  area: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  price: string;

  @IsString()
  @IsOptional()
  priceUnit?: string;

  @IsString()
  @IsOptional()
  priceType?: string;

  @IsString()
  @IsOptional() // Can be optional if villa
  rooms: string;

  @IsString()
  @IsOptional()
  amenities?: string;

  // --- New Fields for Villa Rental ---
  
  @IsString() @IsOptional() landArea?: string;
  @IsString() @IsOptional() builtArea?: string;
  @IsString() @IsOptional() typology?: string;
  @IsString() @IsOptional() configuration?: string;
  @IsString() @IsOptional() floorCount?: string;
  @IsString() @IsOptional() state?: string;
  
  @IsString() @IsOptional() parkingCount?: string;
  @IsString() @IsOptional() outdoorParking?: string;

  @IsString() @IsOptional() usageType?: string;

  @IsString() @IsOptional() nbSuites?: string;
  @IsString() @IsOptional() nbLivingRooms?: string;
  @IsString() @IsOptional() nbBathrooms?: string;
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

  @IsString() @IsOptional() contacts?: string; // JSON String

  @IsString() @IsOptional() imagesMetadata?: string; // JSON String

  @IsOptional()
  userId?: string;
}
