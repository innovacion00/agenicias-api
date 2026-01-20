import { 
  IsString, 
  IsOptional, 
  IsArray,
  IsEmail,
  IsDateString,
  IsEnum,
  ValidateNested,
  IsNotEmpty,
  Matches
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para información de pago en bookPackage
 */
class PaymentDto {
  @IsOptional()
  @IsString()
  @IsEnum(['FLIGHT_ONLY', 'ALL_NOW', 'FLIGHT_NOW_HOTEL_LATER'], {
    message: 'payment_type debe ser uno de: FLIGHT_ONLY, ALL_NOW, FLIGHT_NOW_HOTEL_LATER'
  })
  payment_type?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'deferred_payment_date debe venir en formato YYYY-MM-DD',
  })
  deferred_payment_date?: string;
}

/**
 * DTO para información de pasajero en bookPackage
 */
class PassengerDto {
  @IsString()
  @IsNotEmpty()
  passengerId: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(['adult', 'child', 'infant'], {
    message: 'type_passenger debe ser uno de: adult, child, infant'
  })
  type_passenger: 'adult' | 'child' | 'infant';

  @IsString()
  @IsNotEmpty()
  @IsEnum(['Mr', 'Mrs', 'Miss', 'Ms'], {
    message: 'title debe ser uno de: Mr, Mrs, Miss, Ms'
  })
  title: 'Mr' | 'Mrs' | 'Miss' | 'Ms';

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  surname: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  contact_number: string;

  @IsDateString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date_of_birth debe venir en formato YYYY-MM-DD',
  })
  date_of_birth: string;

  @IsString()
  @IsNotEmpty()
  document_type: string;

  @IsString()
  @IsNotEmpty()
  document_number: string;

  @IsString()
  @IsNotEmpty()
  document_issuance: string;

  @IsDateString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'document_expiration debe venir en formato YYYY-MM-DD',
  })
  document_expiration: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  province?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  postalcode?: string;

  @IsString()
  @IsOptional()
  residence_type?: string;

  @IsString()
  @IsOptional()
  residence?: string;

  @IsString()
  @IsOptional()
  frequent_flyer_number?: string;

  @IsString()
  @IsOptional()
  frequent_flyer_type?: string;
}

/**
 * DTO para reservar un paquete de vuelo en MaarLab Oceanflights
 */
export class BookPackageDto {
  @IsString()
  @IsNotEmpty()
  packageId: string;

  @IsString()
  @IsOptional()
  hotel_id?: string;

  @IsString()
  @IsOptional()
  partner_id?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PassengerDto)
  @IsNotEmpty()
  passengers: PassengerDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentDto)
  payment?: PaymentDto;
}
