import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

class DocumentDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['CC', 'NIT', 'CA', 'PA'])
  tipo: 'CC' | 'NIT' | 'CA' | 'PA';

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @Matches(/^[^\s._]+$/, {
    message: 'document no puede contener espacios guiones bajos.',
  })
  document: string;
}

export class CreateAgenciaDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  fullName: string;

  @IsEmail()
  @IsNotEmpty()
  emailContacto: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(7)
  @MaxLength(15)
  @IsPhoneNumber()
  telefonoContacto: string;

  @IsIn([0, 1], { message: 'Solo son permitidas categorias de 0 o 1' })
  category: number;

  @ValidateNested()
  @IsNotEmpty()
  @Type(() => DocumentDto)
  documentInfo: {
    tipo: 'CC' | 'NIT' | 'CA' | 'PA';
    document: string;
  };
}
