import {
  IsString,
  IsOptional,
  IsInt,
  IsEmail,
  IsNotEmpty,
  IsEnum,
} from 'class-validator';

/**
 * DTO para crear agencias de viajes con configuración por defecto usando la API de MaarLab Oceanflights
 */
export class TravelAgencyCompleteProcessDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  external_id: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  id_chain_search_engine: string;

  @IsString()
  @IsNotEmpty()
  direction: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  id_partner: string;

  @IsInt()
  @IsNotEmpty()
  clasification: number;

  @IsString()
  @IsNotEmpty()
  currency_code: string;

  @IsString()
  @IsNotEmpty()
  post_code: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsNotEmpty()
  website: string;

  @IsString()
  @IsNotEmpty()
  hours_of_operation: string;

  @IsString()
  @IsNotEmpty()
  cif: string;

  @IsString()
  @IsNotEmpty()
  registered_company_name: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(['RING2TRAVEL', 'PROPIO_RING2TRAVEL', 'PROPIO'], {
    message:
      'contact_center_type debe ser uno de: RING2TRAVEL, PROPIO_RING2TRAVEL, PROPIO',
  })
  contact_center_type: 'RING2TRAVEL' | 'PROPIO_RING2TRAVEL' | 'PROPIO';

  @IsString()
  @IsNotEmpty()
  account_manager_name: string;

  @IsEmail()
  @IsNotEmpty()
  account_manager_email: string;

  @IsString()
  @IsOptional()
  account_manager_phone?: string;

  @IsString()
  @IsOptional()
  prefix_locator?: string;
}
