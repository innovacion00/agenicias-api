import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';
import {
  Agency,
  IreservaInfo,
  IreservaInfoBd,
  RoomsDatum,
  ValidCities,
} from 'src/common/interface';
import { IAsistente, ITitularInfo, ValidTipoRecogida } from '../interfaces';
import { IsNotFutureDate, IsNotSameDayCheckin } from '../decorators';

class AgencyDto {
  @IsBoolean()
  @IsNotEmpty()
  is_agency: boolean;

  @IsIn([1, 0])
  @IsNotEmpty()
  agency_type: 0 | 1;

  @IsString()
  @IsNotEmpty()
  external_ref_id: string;
}

class RoomsDatumDto {
  @IsString()
  @IsNotEmpty()
  nombreHabitacion: string;

  @IsString()
  @IsNotEmpty()
  adults: string;

  @IsString()
  @IsOptional()
  children: string;

  @IsString()
  @IsOptional()
  children_ages: string;

  @IsString()
  @IsNotEmpty()
  @IsNotFutureDate()
  @IsNotSameDayCheckin()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'checkin debe venir en formato YYYY-MM-DD',
  })
  checkin: string;

  @IsString()
  @IsNotEmpty()
  @IsNotFutureDate()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'checkout debe venir en formato YYYY-MM-DD',
  })
  checkout: string;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  quantity: string;

  @IsString()
  @IsNotEmpty()
  rateId: string;

  @IsNumber()
  @IsNotEmpty()
  unitaryPrice: number;
}

class ReservaInfoDbDto {
  @IsOptional()
  @IsString()
  source_of_bussiness: string;

  @IsString()
  @IsNotEmpty()
  adults: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'checkin debe venir en formato YYYY-MM-DD',
  })
  @IsNotFutureDate()
  @IsNotSameDayCheckin()
  checkin: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'checkout debe venir en formato YYYY-MM-DD',
  })
  @IsNotFutureDate()
  checkout: string;

  @IsString()
  @IsNotEmpty()
  children: string;

  @IsString()
  children_ages: string;

  @IsEnum(ValidCities, {
    message: (args) => {
      const validCities = Object.values(ValidCities).join(',');
      return `city ${args.value} no esta en las ciudades validad: ${validCities}.`;
    },
  })
  @IsNotEmpty()
  city: ValidCities;

  @IsString()
  @IsNotEmpty()
  @IsIn(['COL'])
  country: string;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(7)
  @MaxLength(15)
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: 'telephone debe venir en formato telefonico valido',
  })
  telephone: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  nights: string;

  @IsOptional()
  @IsString()
  notes: string;

  @IsString()
  @IsNotEmpty()
  rooms: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoomsDatumDto)
  roomsData: RoomsDatum[];
}

class ReservaInfoDto {
  @ValidateNested()
  @Type(() => AgencyDto)
  agency: Agency;

  @ValidateNested()
  @Type(() => ReservaInfoDbDto)
  reservation: IreservaInfoBd;
}

class AsistenteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @MinLength(5)
  fullName: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['CC', 'NIT', 'CE', 'PA'])
  tipoDocumento: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @Matches(/^[^\s._]+$/, {
    message: 'document no puede contener espacios guiones bajos.',
  })
  documento: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(7)
  @MaxLength(15)
  @IsPhoneNumber()
  telefono: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;
}

class TitularInfoDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  lastName: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['CC', 'NIT', 'CE', 'PA'], {
    message: 'tipoDocumento debe ser CC, NIT, CE o PA',
  })
  tipoDocumento: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @Matches(/^[^\s._]+$/, {
    message: 'document no puede contener espacios guiones bajos.',
  })
  documento: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaNacimineto debe venir en formato YYYY-MM-DD',
  })
  fechaNacimiento: string;
}

class RetencionesDto {
  @IsNumber()
  @IsOptional()
  @IsPositive()
  porcentaje: number;

  @IsNumber()
  @IsOptional()
  @IsPositive()
  resultado: number;
}

export class InfoTransporteDto {
  @IsString()
  @MinLength(2)
  numeroVuelo: string;

  @IsString()
  @MinLength(2)
  @IsOptional()
  numeroVueloSalida?: string;

  @IsString()
  @MinLength(2)
  aerolinea: string;

  @IsNumber()
  @IsNotEmpty()
  @IsEnum(ValidTipoRecogida, {
    message: `tipoRecogida debe ser uno de: ${Object.values(ValidTipoRecogida)
      .filter((val) => typeof val === 'number')
      .join(' ,')}`,
  })
  tipoRecogida: ValidTipoRecogida;

  @IsString()
  @IsPhoneNumber()
  firstContactNumber: string;

  @IsString()
  @IsPhoneNumber()
  @IsOptional()
  secondContacNumber?: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Max(50)
  cantidadPersonas: number;
}

export class InfoTouresDto {
  @IsArray()
  @IsString({ each: true })
  nombres: string[];

  @IsString()
  @IsPhoneNumber()
  firstContactNumber: string;

  @IsString()
  @IsPhoneNumber()
  @IsOptional()
  secondContacNumber?: string;
}

/**
 * Item de desglose de precios de la reserva (snapshot).
 * Representa un concepto (hospedaje, transporte, tour, mascotas, alimentación,
 * impuestos, retenciones, vuelo) con su valor. La suma de los ítems debe
 * cuadrar con el `total` de la reserva en la moneda de `reservation.currency`.
 */
export class DesglosePrecioDto {
  @ApiPropertyOptional({
    description:
      'Categoría del ítem: hospedaje, transporte, tour, mascotas, alimentacion, impuestos, retencion, vuelo.',
  })
  @IsString()
  @IsNotEmpty()
  concepto: string;

  @ApiPropertyOptional({
    description: 'Descripción o nombre específico (ej. nombre del tour).',
  })
  @IsOptional()
  @IsString()
  detalle?: string;

  @ApiPropertyOptional({
    description: 'Cantidad (personas, vehículos, mascotas, unidades).',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  cantidad?: number;

  @ApiPropertyOptional({
    description: 'Valor unitario en la moneda de la reserva.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioUnitario?: number;

  @ApiPropertyOptional({
    description:
      'Valor total del ítem en la moneda de la reserva. Puede ser negativo para conceptos que descuentan (ej. retenciones).',
  })
  @IsNumber()
  total: number;
}

export class CreateReservaDto {
  @IsBoolean()
  @IsOptional()
  mascotas?: boolean;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 50,
    description:
      '`0` = sin mascotas. Derivado típico: `reserva.mascotas` según uso en servicio.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  mascotasNumber?: number;

  @ApiPropertyOptional({
    maxLength: 8000,
    description:
      'Notas opcionales a nivel raíz (alternativa coherente con MyTool); se fusionan en `reservaInfo.reservation.notes`.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  origenIata?: string;

  @IsNumber()
  @IsNotEmpty()
  total: number;

  @IsBoolean()
  @IsOptional()
  adicionCena: boolean;

  @IsBoolean()
  @IsOptional()
  adicionAlmuerzo: boolean;

  @ValidateNested()
  @Type(() => InfoTransporteDto)
  @IsOptional()
  infoTransporte?: InfoTransporteDto;

  @ValidateNested()
  @Type(() => InfoTouresDto)
  @IsOptional()
  infoToures?: InfoTouresDto;

  @ValidateNested()
  @Type(() => RetencionesDto)
  @IsOptional()
  reteFuente: RetencionesDto;

  @ValidateNested()
  @Type(() => RetencionesDto)
  @IsOptional()
  reteIca: RetencionesDto;

  @ValidateNested()
  @Type(() => RetencionesDto)
  @IsOptional()
  reteIva: RetencionesDto;

  @IsBoolean()
  @IsOptional()
  exentoIva: boolean;

  @ValidateNested({ each: true })
  @Type(() => AsistenteDto)
  @IsArray()
  @IsOptional()
  asistentes: IAsistente[];

  @ValidateNested()
  @Type(() => TitularInfoDto)
  @IsNotEmpty()
  titularInfo: ITitularInfo;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  planAlimentario: string;

  @ValidateNested()
  @Type(() => ReservaInfoDto)
  @IsNotEmpty()
  reservaInfo: IreservaInfo;

  @ApiPropertyOptional({
    description:
      'Desglose de precios (snapshot): cuanto corresponde a hospedaje y a cada extra (transporte, tours, mascotas, alimentación, impuestos/retenciones).',
    type: [DesglosePrecioDto],
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DesglosePrecioDto)
  @IsArray()
  desglosePrecios?: DesglosePrecioDto[];
}
