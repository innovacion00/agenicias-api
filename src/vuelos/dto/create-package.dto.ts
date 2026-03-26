import {
  IsString,
  IsOptional,
  ValidateNested,
  IsIn,
  IsNotEmpty,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Webhooks en createPackage (Consolidator OceanFlights).
 * MaarLab hará GET a estas URLs con package_id en query cuando corresponda.
 */
export class ConsolidatorWebhookDto {
  @IsOptional()
  @IsString()
  @Transform(trim)
  booking_url?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  payment_url?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  canceled_url?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  contracting_url?: string;
}

/**
 * Objeto hotel en createPackage: sin datos de hotel real, solo webhook opcional.
 */
export class ConsolidatorHotelDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ConsolidatorWebhookDto)
  webhook?: ConsolidatorWebhookDto;
}

/**
 * DTO para crear un paquete de vuelo en MaarLab Oceanflights (Consolidator).
 */
export class CreatePackageDto {
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  flightId: string;

  /** Doc: USD o EUR */
  @IsOptional()
  @IsString()
  @IsIn(['USD', 'EUR'], { message: 'currency debe ser USD o EUR' })
  currency?: string;

  /** Doc: EN o ES */
  @IsOptional()
  @IsString()
  @IsIn(['EN', 'ES'], { message: 'language debe ser EN o ES' })
  language?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConsolidatorHotelDto)
  hotel?: ConsolidatorHotelDto;
}
