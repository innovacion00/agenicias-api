import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ConceptoExtra, UnidadExtra } from '../entities/precio-extra.entity';

export class CreatePrecioExtraDto {
  @IsEnum(ConceptoExtra)
  concepto: ConceptoExtra;

  @IsString()
  detalle: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  hotelId?: number | null;

  @IsOptional()
  @IsString()
  ciudad?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precioCOP?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precioUSD?: number | null;

  @IsEnum(UnidadExtra)
  unidad: UnidadExtra;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  paxPorVehiculo?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  porcentaje?: number | null;

  @IsOptional()
  @Type(() => Date)
  vigenciaDesde?: Date | null;

  @IsOptional()
  @Type(() => Date)
  vigenciaHasta?: Date | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orden?: number;

  @IsOptional()
  informacion?: Record<string, unknown>;
}