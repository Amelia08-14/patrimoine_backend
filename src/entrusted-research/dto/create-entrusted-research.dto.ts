import { IsEnum, IsNumber, IsOptional, IsString, IsDateString, IsNotEmpty } from 'class-validator';
import { TransactionType } from '@prisma/client';

export class CreateEntrustedResearchDto {
  @IsEnum(TransactionType)
  transaction: TransactionType;

  @IsOptional()
  @IsNumber()
  minSurface?: number;

  @IsOptional()
  @IsNumber()
  maxSurface?: number;

  @IsOptional()
  @IsNumber()
  nbPieces?: number;

  @IsOptional()
  @IsNumber()
  nbRooms?: number;

  @IsOptional()
  @IsNumber()
  nbFloors?: number;

  @IsNumber()
  minBudget: number;

  @IsNumber()
  maxBudget: number;

  @IsDateString()
  installationDate: string;

  @IsOptional()
  @IsNumber()
  cityId?: number;

  @IsOptional()
  @IsString()
  towns?: string;

  @IsString()
  @IsNotEmpty()
  comment: string;

  @IsOptional()
  @IsNumber()
  userId?: number;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  email?: string;
  
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  activity?: string;

  @IsOptional()
  @IsString()
  realEstateType?: string;

  @IsOptional()
  @IsString()
  propertyType?: string;

  @IsOptional()
  @IsString()
  amenities?: string;
}
