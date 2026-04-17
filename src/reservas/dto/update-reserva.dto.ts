import {
  IsEmail,
  IsOptional,
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
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: 'telephone debe venir en formato telefonico valido',
  })
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
