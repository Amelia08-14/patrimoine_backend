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
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  area: string;

  @IsString()
  @IsNotEmpty()
  price: string;

  @IsString()
  @IsNotEmpty()
  rooms: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  amenities?: string;

  @IsOptional()
  userId?: string;
}
