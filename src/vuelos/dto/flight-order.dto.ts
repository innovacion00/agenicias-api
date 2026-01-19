import { 
  IsString, 
  IsArray, 
  IsOptional, 
  IsEmail, 
  IsEnum, 
  IsDateString, 
  IsBoolean, 
  ValidateNested, 
  IsNumber,
  ArrayMinSize,
  IsNotEmpty
} from 'class-validator';
import { Type } from 'class-transformer';

// Clases básicas primero
export class NameDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;
}

export class PhoneDto {
  @IsEnum(['MOBILE', 'LANDLINE'])
  deviceType: 'MOBILE' | 'LANDLINE';

  @IsString()
  countryCallingCode: string;

  @IsString()
  number: string;
}

export class ContactDto {
  @IsEmail()
  emailAddress: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhoneDto)
  phones: PhoneDto[];
}

export class DocumentDto {
  @IsEnum(['PASSPORT', 'ID_CARD'])
  documentType: 'PASSPORT' | 'ID_CARD';

  @IsString()
  @IsOptional()
  birthPlace?: string;

  @IsString()
  @IsOptional()
  issuanceLocation?: string;

  @IsDateString()
  @IsOptional()
  issuanceDate?: string;

  @IsString()
  number: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @IsString()
  @IsOptional()
  issuanceCountry?: string;

  @IsString()
  @IsOptional()
  validityCountry?: string;

  @IsString()
  @IsOptional()
  nationality?: string;

  @IsBoolean()
  holder: boolean;
}

export class FlightOrderTravelerDto {
  @IsString()
  id: string;

  @IsDateString()
  dateOfBirth: string;

  @ValidateNested()
  @Type(() => NameDto)
  name: NameDto;

  @IsEnum(['MALE', 'FEMALE'])
  gender: 'MALE' | 'FEMALE';

  @ValidateNested()
  @Type(() => ContactDto)
  contact: ContactDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentDto)
  documents?: DocumentDto[];
}

export class LocationDto {
  @IsString()
  iataCode: string;

  @IsString()
  @IsOptional()
  terminal?: string;

  @IsString()
  at: string;
}

export class AircraftDto {
  @IsString()
  code: string;
}

export class OperatingDto {
  @IsString()
  @IsOptional()
  carrierCode?: string;

  @IsString()
  @IsOptional()
  carrierName?: string;
}

export class SegmentDto {
  @ValidateNested()
  @Type(() => LocationDto)
  departure: LocationDto;

  @ValidateNested()
  @Type(() => LocationDto)
  arrival: LocationDto;

  @IsString()
  carrierCode: string;

  @IsString()
  number: string;

  @ValidateNested()
  @Type(() => AircraftDto)
  aircraft: AircraftDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingDto)
  operating?: OperatingDto;

  @IsString()
  duration: string;

  @IsString()
  id: string;

  @IsNumber()
  numberOfStops: number;
}

export class ItineraryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SegmentDto)
  segments: SegmentDto[];
}

export class FeeDto {
  @IsString()
  amount: string;

  @IsString()
  type: string;
}

export class AdditionalServiceDto {
  @IsString()
  amount: string;

  @IsString()
  type: string;
}

export class PriceDto {
  @IsString()
  currency: string;

  @IsString()
  total: string;

  @IsString()
  base: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeeDto)
  fees: FeeDto[];

  @IsString()
  grandTotal: string;

  @IsString()
  @IsOptional()
  billingCurrency?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdditionalServiceDto)
  additionalServices?: AdditionalServiceDto[];
}

export class PricingOptionsDto {
  @IsArray()
  @IsString({ each: true })
  fareType: string[];

  @IsBoolean()
  includedCheckedBagsOnly: boolean;
}

export class BaggageDto {
  @IsNumber()
  quantity: number;
}

export class FareDetailsBySegmentDto {
  @IsString()
  segmentId: string;

  @IsString()
  cabin: string;

  @IsString()
  fareBasis: string;

  @IsString()
  @IsOptional()
  brandedFare?: string;

  @IsString()
  @IsOptional()
  brandedFareLabel?: string;

  @IsString()
  class: string;

  @ValidateNested()
  @Type(() => BaggageDto)
  includedCheckedBags: BaggageDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BaggageDto)
  includedCabinBags?: BaggageDto;
}

export class TravelerPricingPriceDto {
  @IsString()
  currency: string;

  @IsString()
  total: string;

  @IsString()
  base: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeeDto)
  fees?: FeeDto[];

  @IsOptional()
  @IsString()
  grandTotal?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxDto)
  taxes?: TaxDto[];
}

export class TaxDto {
  @IsString()
  amount: string;

  @IsString()
  code: string;
}

export class TravelerPricingDto {
  @IsString()
  travelerId: string;

  @IsString()
  fareOption: string;

  @IsEnum(['ADULT', 'CHILD', 'INFANT'])
  travelerType: 'ADULT' | 'CHILD' | 'INFANT';

  @ValidateNested()
  @Type(() => TravelerPricingPriceDto)
  price: TravelerPricingPriceDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FareDetailsBySegmentDto)
  fareDetailsBySegment: FareDetailsBySegmentDto[];
}

export class FlightOfferDto {
  @IsString()
  @IsOptional()
  type?: 'flight-offer' = 'flight-offer';

  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsOptional()
  source?: string = 'GDS';

  @IsBoolean()
  @IsOptional()
  instantTicketingRequired?: boolean = false;

  @IsBoolean()
  @IsOptional()
  nonHomogeneous?: boolean = false;

  @IsBoolean()
  @IsOptional()
  paymentCardRequired?: boolean = false;

  @IsString()
  @IsOptional()
  lastTicketingDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItineraryDto)
  itineraries: ItineraryDto[];

  @ValidateNested()
  @Type(() => PriceDto)
  price: PriceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PricingOptionsDto)
  pricingOptions?: PricingOptionsDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  validatingAirlineCodes?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TravelerPricingDto)
  travelerPricings?: TravelerPricingDto[];
}

export class GeneralRemarkDto {
  @IsString()
  subType: string;

  @IsString()
  text: string;
}

export class RemarksDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GeneralRemarkDto)
  general?: GeneralRemarkDto[];
}

export class TicketingAgreementDto {
  @IsEnum(['DELAY_TO_CANCEL'])
  option: 'DELAY_TO_CANCEL';

  @IsString()
  delay: string;
}

export class AddressDto {
  @IsArray()
  @IsString({ each: true })
  lines: string[];

  @IsString()
  postalCode: string;

  @IsString()
  cityName: string;

  @IsString()
  countryCode: string;
}

export class ContactInfoDto {
  @ValidateNested()
  @Type(() => NameDto)
  addresseeName: NameDto;

  @IsString()
  @IsOptional()
  companyName?: string;

  @IsEnum(['STANDARD', 'LEISURE', 'BUSINESS'])
  purpose: 'STANDARD' | 'LEISURE' | 'BUSINESS';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhoneDto)
  phones: PhoneDto[];

  @IsEmail()
  emailAddress: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;
}

// Clase principal al final
export class FlightOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FlightOfferDto)
  flightOffers: FlightOfferDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FlightOrderTravelerDto)
  travelers: FlightOrderTravelerDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => RemarksDto)
  remarks?: RemarksDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TicketingAgreementDto)
  ticketingAgreement?: TicketingAgreementDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactInfoDto)
  contacts?: ContactInfoDto[];
}