import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { CompanyActivity } from '@prisma/client';

export class CreateAuthDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
  
  // User Type
  @IsOptional()
  @IsString()
  userType?: 'PARTICULIER' | 'SOCIETE';

  // Company Fields
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsEnum(CompanyActivity)
  activityType?: CompanyActivity;

  @IsOptional()
  @IsString()
  commercialRegister?: string;

  @IsOptional()
  @IsNumber()
  townId?: number;

  @IsOptional()
  @IsNumber()
  cityCode?: number;

  @IsOptional()
  @IsNumber()
  townCode?: number;
}
