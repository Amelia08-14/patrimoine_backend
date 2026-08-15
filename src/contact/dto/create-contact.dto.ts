import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const CONTACT_MOTIFS = ['COMMERCIAL', 'JURIDIQUE', 'TECHNIQUE', 'GENERAL'] as const;

export class CreateContactDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(150)
  name: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(254)
  email: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsIn(CONTACT_MOTIFS)
  motif?: string;
}
