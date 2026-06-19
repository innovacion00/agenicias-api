import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IdisponibilidadLayout, ValidCities } from 'src/autocore/interfaces';
import { IsNotFutureDate } from '../decorators';

class DisponibilidadLayoutDto {
  @ApiProperty({
    description: 'Número de adultos',
    example: 2,
    type: Number,
    minimum: 1,
  })
  @Min(1)
  @IsNotEmpty()
  adults: number;

  @ApiProperty({
    description: 'Edades de los niños',
    example: [5, 8],
    type: [Number],
    required: false,
  })
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(0)
  @IsOptional()
  children_ages: number[];
}

export class DisponibilidadAutocoreDto {
  @ApiProperty({
    description: 'Fecha de check-in en formato YYYY-MM-DD',
    example: '2025-12-01',
    type: String,
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  })
  @IsString()
  @Length(10, 10)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe venir en formato YYYY-MM-DD',
  })
  @IsNotFutureDate()
  @IsNotEmpty()
  checkingDate: string;

  @ApiProperty({
    description: 'Número de noches',
    example: 3,
    type: Number,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  nights: number;

  @ApiProperty({
    description: 'Ciudad donde se busca disponibilidad',
    example: 'CARTAGENA',
    enum: ValidCities,
  })
  @IsString()
  @IsEnum(ValidCities, {
    message: (args) => {
      const validCities = Object.values(ValidCities).join(',');
      return `La ciudad ${args.value} no esta en las ciudades validas: ${validCities}.`;
    },
  })
  ciudad: ValidCities;

  @ApiProperty({
    description: 'Layout de habitaciones (adultos y niños por habitación)',
    type: [DisponibilidadLayoutDto],
    example: [{ adults: 2, children_ages: [5, 8] }],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DisponibilidadLayoutDto)
  layout: IdisponibilidadLayout[];

  @ApiProperty({
    description: 'Categoría de agencia: 0 = Minorista, 1 = Mayorista',
    example: 0,
    type: Number,
    enum: [0, 1],
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @IsIn([0, 1], { message: 'La propiedad category debe de ser 0 o 1' })
  category?: 0 | 1;
}
