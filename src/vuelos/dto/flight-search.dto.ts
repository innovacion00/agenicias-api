import { 
  IsString, 
  IsOptional, 
  IsEnum, 
  IsNumber, 
  Min, 
  Max, 
  IsArray, 
  IsDateString,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// DTOs anidados para validación
export class OriginDestinationDto {
  @IsString()
  id: string;

  @IsString()
  @Transform(({ value }) => value.toUpperCase())
  originLocationCode: string;

  @IsString()
  @Transform(({ value }) => value.toUpperCase())
  destinationLocationCode: string;

  @IsDateString()
  departureDate: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value || '00:00:00')
  departureTime?: string = '00:00:00';

  // Método para transformar a AmadeusOriginDestination
  toAmadeusFormat() {
    return {
      id: this.id,
      originLocationCode: this.originLocationCode,
      destinationLocationCode: this.destinationLocationCode,
      departureDateTimeRange: {
        date: this.departureDate,
        time: this.departureTime
      }
    };
  }
}

export class TravelerDto {
  @IsString()
  id: string;

  @IsEnum(['ADULT', 'CHILD', 'SENIOR', 'YOUNG', 'DISABLED', 'DISABLED_CHILD', 'ESCORT', 'LARGE_FAMILY', 'STUDENT'])
  travelerType: 'ADULT' | 'CHILD' | 'SENIOR' | 'YOUNG' | 'DISABLED' | 'DISABLED_CHILD' | 'ESCORT' | 'LARGE_FAMILY' | 'STUDENT';
}

export class CabinRestrictionDto {
  @IsEnum(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'])
  cabin: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';

  @IsEnum(['MOST_SEGMENTS', 'AT_LEAST_ONE_SEGMENT', 'ALL_SEGMENTS'])
  coverage: 'MOST_SEGMENTS' | 'AT_LEAST_ONE_SEGMENT' | 'ALL_SEGMENTS';

  @IsArray()
  @IsString({ each: true })
  originDestinationIds: string[];
}

export class FlightFiltersDto {
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CabinRestrictionDto)
  cabinRestrictions?: CabinRestrictionDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedCarrierCodes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includedCarrierCodes?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value || '00:00:00')
  earliestDepartureTime?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value || '23:59:59')
  latestDepartureTime?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxNumberOfConnections?: number;
}

export class SearchCriteriaDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(250)
  @Transform(({ value }) => parseInt(value))
  maxFlightOffers?: number = 50;

  @IsOptional()
  @ValidateNested()
  @Type(() => FlightFiltersDto)
  flightFilters?: FlightFiltersDto;
}

// DTO principal para búsqueda de vuelos
export class FlightSearchDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toUpperCase())
  currencyCode?: string = 'USD';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => OriginDestinationDto)
  originDestinations: OriginDestinationDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  @ValidateNested({ each: true })
  @Type(() => TravelerDto)
  travelers: TravelerDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sources?: string[] = ['GDS'];

  @IsOptional()
  @ValidateNested()
  @Type(() => SearchCriteriaDto)
  searchCriteria?: SearchCriteriaDto;
}
