import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotFutureDate } from 'src/reservas/decorators';

export class DisponibilidadPersonasDto {
  @ApiProperty({
    description: 'Ciudad para buscar disponibilidad',
    example: 'Cartagena',
    type: String,
    enum: ['Cartagena', 'Bogota', 'Santa marta'],
  })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({
    description: 'Fecha de check-in en formato YYYY-MM-DD',
    example: '2025-02-22',
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
  checkin: string;

  @ApiProperty({
    description: 'Número de noches',
    example: 2,
    type: Number,
    minimum: 1,
  })
  @IsNumber()
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  nights: number;

  @ApiProperty({
    description: 'Número de adultos',
    example: 2,
    type: Number,
    minimum: 1,
  })
  @IsNumber()
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  adults: number;

  @ApiProperty({
    description: 'Edades de los niños separadas por comas',
    example: '10,14',
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  children_ages?: string;

  @ApiProperty({
    description: 'Tipo de habitación (opcional)',
    example: 'standard',
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  room_type?: string;
}

