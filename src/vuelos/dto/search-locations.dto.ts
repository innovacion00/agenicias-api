import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AMADEUS_CONSTANTS } from '../../config/constants';

export class SearchLocationsDto {
  @IsString()
  @Transform(({ value }) => value.toUpperCase())
  keyword: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      // Validar que solo contenga valores válidos separados por coma
      const validValues = ['AIRPORT', 'CITY'];
      const parts = value.split(',').map((part) => part.trim().toUpperCase());
      const isValid = parts.every((part) => validValues.includes(part));
      if (!isValid) {
        throw new Error(
          'subType debe contener solo AIRPORT y/o CITY separados por coma',
        );
      }
      return parts.join(',');
    }
    return value;
  })
  subType?: string = AMADEUS_CONSTANTS.SUB_TYPES.BOTH;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.toUpperCase())
  countryCode?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  'page[limit]'?: number = AMADEUS_CONSTANTS.DEFAULT_PAGE_LIMIT;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Transform(({ value }) => parseInt(value))
  'page[offset]'?: number = AMADEUS_CONSTANTS.DEFAULT_PAGE_OFFSET;

  @IsEnum([AMADEUS_CONSTANTS.SORT_TYPES.TRAVELERS_SCORE])
  @IsOptional()
  sort?: 'analytics.travelers.score' =
    AMADEUS_CONSTANTS.SORT_TYPES.TRAVELERS_SCORE;

  @IsEnum([
    AMADEUS_CONSTANTS.VIEW_TYPES.LIGHT,
    AMADEUS_CONSTANTS.VIEW_TYPES.FULL,
  ])
  @IsOptional()
  view?: 'LIGHT' | 'FULL' = AMADEUS_CONSTANTS.VIEW_TYPES.FULL;
}
