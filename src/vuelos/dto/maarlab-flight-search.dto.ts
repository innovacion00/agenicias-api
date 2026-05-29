import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsDateString,
  Matches,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO para búsqueda de vuelos en MaarLab Oceanflights
 */
export class MaarLabFlightSearchDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.toUpperCase())
  origin: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.toUpperCase())
  destination: string;

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'departureDate debe venir en formato YYYY-MM-DD',
  })
  departureDate: string;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'returnDate debe venir en formato YYYY-MM-DD',
  })
  returnDate?: string;

  @IsNumber()
  @Min(1)
  @Max(50)
  @Transform(({ value }) => parseInt(value))
  adults: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(17, { each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.map((v) => parseInt(v));
    }
    return value ? [parseInt(value)] : undefined;
  })
  ages?: number[];

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    return Boolean(value);
  })
  canarian_resident?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    return Boolean(value);
  })
  balear_resident?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    return Boolean(value);
  })
  ceuta_melilla_resident?: boolean;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toUpperCase())
  search_mode?: 'SEARCH_FLIGHT_DEFAULT' | 'SEARCH_FLIGHT' | 'SEARCH_BEST_DEAL';

  @IsString()
  @Matches(/^[A-Z]{3}$/, {
    message:
      'currency debe ser exactamente 3 caracteres en mayúsculas (ej: EUR, USD)',
  })
  @Transform(({ value }) => value?.toUpperCase())
  currency: string;
}
