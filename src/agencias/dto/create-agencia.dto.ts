import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class DocumentDto {
  @ApiProperty({
    description: 'Tipo de documento',
    example: 'CC',
    enum: ['CC', 'NIT', 'CE', 'PA'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['CC', 'NIT', 'CE', 'PA'])
  tipo: 'CC' | 'NIT' | 'CE' | 'PA';

  @ApiProperty({
    description: 'Número de documento (sin espacios ni guiones bajos)',
    example: '1234567890',
    type: String,
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @Matches(/^[^\s._]+$/, {
    message: 'document no puede contener espacios guiones bajos.',
  })
  document: string;
}

export class CreateAgenciaDto {
  @ApiProperty({
    description: 'Nombre completo de la agencia',
    example: 'Agencia de Viajes Ejemplo',
    type: String,
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({
    description: 'Email de contacto de la agencia',
    example: 'contacto@agenciaejemplo.com',
    type: String,
  })
  @IsEmail()
  @IsNotEmpty()
  emailContacto: string;

  @ApiProperty({
    description: 'Teléfono de contacto de la agencia',
    example: '+573001234567',
    type: String,
    minLength: 7,
    maxLength: 15,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(7)
  @MaxLength(15)
  @IsPhoneNumber()
  telefonoContacto: string;

  @ApiProperty({
    description: 'Categoría de la agencia: 0 = Minorista, 1 = Mayorista',
    example: 0,
    type: Number,
    enum: [0, 1],
  })
  @IsIn([0, 1], { message: 'Solo son permitidas categorias de 0 o 1' })
  category: number;

  @ApiProperty({
    description: 'Indica si es una empresa',
    example: false,
    type: Boolean,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  @IsNotEmpty()
  empresa: boolean;

  @ApiProperty({
    description: 'Información del documento de la agencia',
    type: DocumentDto,
  })
  @ValidateNested()
  @IsNotEmpty()
  @Type(() => DocumentDto)
  documentInfo: {
    tipo: 'CC' | 'NIT' | 'CE' | 'PA';
    document: string;
  };

  @ApiProperty({
    description:
      'API key / Bearer token MaarLab (Consolidator). Opcional al crear; se puede actualizar después.',
    required: false,
  })
  @IsOptional()
  @IsString()
  maarlabApiKey?: string;
}
