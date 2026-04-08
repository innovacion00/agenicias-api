import {
  IsString,
  IsOptional,
  IsArray,
  IsEmail,
  IsDateString,
  IsEnum,
  ValidateNested,
  IsNotEmpty,
  Matches,
  ValidateBy,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Tipos de documento según documentación Consolidator (PASSPORT | IDENTITY_CARD).
 */
export enum MaarLabDocumentType {
  PASSPORT = 'PASSPORT',
  IDENTITY_CARD = 'IDENTITY_CARD',
}

class PaymentDto {
  @IsOptional()
  @IsString()
  @IsEnum(['FLIGHT_ONLY', 'ALL_NOW', 'FLIGHT_NOW_HOTEL_LATER'], {
    message:
      'payment_type debe ser uno de: FLIGHT_ONLY, ALL_NOW, FLIGHT_NOW_HOTEL_LATER',
  })
  payment_type?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'deferred_payment_date debe venir en formato YYYY-MM-DD',
  })
  deferred_payment_date?: string;
}

export class PassengerDto {
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  passengerId: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(['adult', 'child', 'infant'], {
    message: 'type_passenger debe ser uno de: adult, child, infant',
  })
  type_passenger: 'adult' | 'child' | 'infant';

  @IsString()
  @IsNotEmpty()
  @IsEnum(['Mr', 'Mrs', 'Miss', 'Ms'], {
    message: 'title debe ser uno de: Mr, Mrs, Miss, Ms',
  })
  title: 'Mr' | 'Mrs' | 'Miss' | 'Ms';

  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  surname: string;

  @IsEmail()
  @IsNotEmpty()
  @Transform(trim)
  email: string;

  /**
   * Doc MaarLab: "+34 6778456767". Solo trim; se conservan espacios para el payload a OceanFlights.
   */
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  @ValidateBy(
    {
      name: 'contactNumberMaarLab',
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          const compact = value.replace(/\s+/g, '');
          return /^\+\d{8,16}$/.test(compact);
        },
        defaultMessage: () =>
          'contact_number debe ser +<código país> y dígitos; se permiten espacios (ej: +34 6778456767)',
      },
    },
  )
  contact_number: string;

  @IsDateString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date_of_birth debe venir en formato YYYY-MM-DD',
  })
  date_of_birth: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(MaarLabDocumentType, {
    message: 'document_type debe ser PASSPORT o IDENTITY_CARD',
  })
  document_type: MaarLabDocumentType;

  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  document_number: string;

  /** País emisión documento (ej. ISO o código que exija MaarLab). */
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  document_issuance: string;

  @IsDateString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'document_expiration debe venir en formato YYYY-MM-DD',
  })
  document_expiration: string;

  /** Doc Consolidator: fecha emisión del documento (YYYY-MM-DD). */
  @IsDateString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'document_issuance_date debe venir en formato YYYY-MM-DD',
  })
  document_issuance_date: string;

  /** Doc: residencia en documento / referencia requerida por el consolidador. */
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  document_residence: string;

  /** Doc: ISO 3166-1 alpha-2 (ej. CO, ES). */
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{2}$/, {
    message: 'country_id debe ser ISO 3166-1 alpha-2 (2 letras, ej. CO)',
  })
  country_id: string;

  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  address: string;

  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  province: string;

  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  city: string;

  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  postalcode: string;

  /** Obligatorios si en la búsqueda se indicó tipo de residente. */
  @IsOptional()
  @IsString()
  @Transform(trim)
  residence_type?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  residence?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  frequent_flyer_number?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  frequent_flyer_type?: string;
}

/**
 * DTO para reservar un paquete de vuelo en MaarLab Oceanflights (Consolidator).
 */
export class BookPackageDto {
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  packageId: string;

  /** Interno: no se reenvía a MaarLab. */
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  reservaChatbotId: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  hotel_id?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
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
