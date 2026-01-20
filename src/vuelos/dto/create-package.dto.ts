import { 
  IsString, 
  IsOptional, 
  IsObject,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para webhook URLs
 */
class WebhookDto {
  @IsOptional()
  @IsString()
  booking_url?: string;

  @IsOptional()
  @IsString()
  payment_url?: string;

  @IsOptional()
  @IsString()
  canceled_url?: string;

  @IsOptional()
  @IsString()
  contracting_url?: string;
}

/**
 * DTO para crear un paquete de vuelo en MaarLab Oceanflights
 */
export class CreatePackageDto {
  @IsString()
  flightId: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  language?: string;
}
