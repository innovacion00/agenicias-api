import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AirportSuggestQueryDto {
  @ApiProperty({
    example: 'bog',
    description:
      'Texto predictivo: nombre, ciudad, IATA o ICAO (prefijo). Con espacios usa búsqueda de texto.',
    minLength: 1,
    maxLength: 80,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  q: string;

  @ApiPropertyOptional({
    example: 'CO',
    description: 'ISO 3166-1 alpha-2 del país para filtrar',
  })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
