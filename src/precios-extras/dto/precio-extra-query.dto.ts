import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ConceptoExtra } from '../entities/precio-extra.entity';

export class PrecioExtraQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  hotelId?: number;

  @IsOptional()
  @IsString()
  ciudad?: string;

  @IsOptional()
  @IsEnum(ConceptoExtra)
  concepto?: ConceptoExtra;

  /**
   * Divisa solicitada para el campo `precio` de la respuesta.
   *
   * Decisión de moneda (A): cada item guarda un par autoritativo COP/USD
   * (precios de mercado, sin conversión). `precio` refleja la divisa pedida;
   * si el item solo tiene una de las dos, devuelve null en la otra y el
   * frontend cae al valor que sí existe.
   */
  @IsOptional()
  @IsIn(['COP', 'USD'])
  currency?: 'COP' | 'USD';
}