import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateReservaDto {
  @IsEmail()
  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @IsOptional()
  firstName?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @IsOptional()
  lastName?: string;

  @IsString()
  @MinLength(7)
  @MaxLength(15)
  @IsPhoneNumber()
  @IsOptional()
  telephone?: string;

  @IsString()
  @MinLength(6)
  @Matches(/^[^\s._]+$/, {
    message: 'document no puede contener espacios guiones bajos.',
  })
  @IsOptional()
  documento?: string;

  @IsString()
  @IsOptional()
  notasSuperAdmin?: string;

  @IsString()
  @IsOptional()
  notasagencias?: string;
}
