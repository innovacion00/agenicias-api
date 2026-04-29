import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
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
import { Type, Transform } from 'class-transformer';
import { IAsistente, ITitularInfo } from '../interfaces';
import { InfoTransporteDto, InfoTouresDto } from './create-reserva.dto';

// ────────────────── Clases auxiliares internas ──────────────────

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
  @MinLength(3)
  @MaxLength(20)
  tipoDocumento: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @Matches(/^[^\s._]+$/, {
    message: 'document no puede contener espacios ni guiones bajos.',
  })
  documento: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaNacimiento debe venir en formato YYYY-MM-DD',
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
  documento: string;

  @IsString()
  @IsNotEmpty()
  @IsPhoneNumber()
  telefono: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;
}

// ────────────────── Estructura exacta de MyTool ──────────────────

export class MyToolDayPriceDto {
  @IsString()
  @IsNotEmpty()
  fecha: string;

  @IsNumber()
  @IsNotEmpty()
  precioBase: number;
}

export class MyToolGuestDto {
  @IsString()
  @IsNotEmpty()
  documId: string;

  @IsNumber()
  @IsNotEmpty()
  documTypeId: number;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  firstLastName: string;

  @IsString()
  @IsOptional()
  secondLastName: string;

  @IsString()
  @IsNotEmpty()
  birthDay: string;

  @IsNumber()
  @IsOptional()
  nacionalityId: number;

  @IsNumber()
  @IsNotEmpty()
  @IsIn([1, 2])
  generId: number;

  @IsString()
  @IsOptional()
  address: string;

  @IsString()
  @IsOptional()
  city: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsNumber()
  @IsOptional()
  countryId: number;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsBoolean()
  @IsNotEmpty()
  isOwner: boolean;

  @IsOptional()
  image1?: any;

  @IsOptional()
  image2?: any;
}

export class MyToolRoomDto {
  @IsNumber()
  @IsNotEmpty()
  categoriaId: number;

  @ApiPropertyOptional({
    maxLength: 200,
    description:
      'Nombre de la habitación. Solo persistencia en `roomsData`; no se envía al API MyTool.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  nombreHabitacion?: string;

  @ApiPropertyOptional({
    maxLength: 120,
    description:
      'Identificador de habitación. Solo persistencia en `roomsData`; no se envía al API MyTool.',
    example: 'hab-101',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? undefined
      : String(value).trim(),
  )
  @IsString()
  @MaxLength(120)
  room_id?: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Max(10)
  paxAdultos: number;

  @IsNumber()
  @Min(0)
  @Max(10)
  paxChilds: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MyToolDayPriceDto)
  dayPrice: MyToolDayPriceDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MyToolGuestDto)
  guest: MyToolGuestDto[];
}

export class MyToolSolicitanteDto {
  @IsString()
  @IsNotEmpty()
  titular: string;

  @IsString()
  @IsNotEmpty()
  telefono: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class MyToolBookDataDto {
  @ValidateNested()
  @Type(() => MyToolSolicitanteDto)
  @IsNotEmpty()
  solicitante: MyToolSolicitanteDto;

  @IsNumber()
  @IsNotEmpty()
  canalVentaId: number;

  @IsString()
  @IsNotEmpty()
  ratePlan: string;

  @IsString()
  @IsOptional()
  paisCode?: string;

  @IsString()
  @IsOptional()
  monedaCode?: string;

  @IsNumber()
  @IsOptional()
  comision?: number;

  @IsBoolean()
  @IsOptional()
  siAgregaImpto?: boolean;

  @IsString()
  @IsOptional()
  acuerdos?: string;

  @IsNumber()
  @IsNotEmpty()
  motivoId: number;

  @IsNumber()
  @IsNotEmpty()
  subSegmentoId: number;

  @IsNumber()
  @IsNotEmpty()
  segmentoId: number;

  @IsOptional()
  agenciaId?: number | string;

  @IsOptional()
  agenteId?: number | string;
}

// ────────────────── DTO principal (body exacto de MyTool + campos internos) ──────────────────

export class CreateReservaMyToolDto {
  // --- Campos exactos de MyTool ---

  @IsNumber()
  @IsNotEmpty()
  hotelId: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'checkIn debe estar en formato YYYY-MM-DD',
  })
  checkIn: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'checkOut debe estar en formato YYYY-MM-DD',
  })
  checkOut: string;

  @IsString()
  @IsOptional()
  usuario?: string;

  @IsNumber()
  @IsOptional()
  maquinaId?: number;

  @ValidateNested()
  @Type(() => MyToolBookDataDto)
  @IsNotEmpty()
  bookData: MyToolBookDataDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MyToolRoomDto)
  rooms: MyToolRoomDto[];

  // --- Campos internos para guardar en MongoDB ---

  @ValidateNested()
  @Type(() => TitularInfoDto)
  @IsNotEmpty()
  titularInfo: ITitularInfo;

  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  total: number;

  @ApiPropertyOptional({
    description:
      'Notas internas (solo persistencia en `reservation.notes` en MongoDB). No se envía al API My Tool; usar `bookData.acuerdos` para texto hacia My Tool.',
    maxLength: 8000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  notes?: string;

  @IsString()
  @IsOptional()
  planAlimentario?: string;

  @IsBoolean()
  @IsOptional()
  adicionCena?: boolean;

  @IsBoolean()
  @IsOptional()
  adicionAlmuerzo?: boolean;

  @IsBoolean()
  @IsOptional()
  mascotas?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(1)
  mascotasNumber?: number;

  @IsOptional()
  @IsString()
  @MinLength(2)
  origenIata?: string;

  @ValidateNested()
  @Type(() => RetencionesDto)
  @IsOptional()
  reteFuente?: RetencionesDto;

  @ValidateNested()
  @Type(() => RetencionesDto)
  @IsOptional()
  reteIva?: RetencionesDto;

  @ValidateNested()
  @Type(() => RetencionesDto)
  @IsOptional()
  reteIca?: RetencionesDto;

  @IsBoolean()
  @IsOptional()
  exentoIva?: boolean;

  @ValidateNested()
  @Type(() => InfoTransporteDto)
  @IsOptional()
  infoTransporte?: InfoTransporteDto;

  @ValidateNested()
  @Type(() => InfoTouresDto)
  @IsOptional()
  infoToures?: InfoTouresDto;

  @ValidateNested({ each: true })
  @Type(() => AsistenteDto)
  @IsArray()
  @IsOptional()
  asistentes?: IAsistente[];
}

// ────────────────── DTOs de cancelación y búsqueda ──────────────────

/** Body alineado con lo que envía el backend a MyTool `POST .../cancelBookAvail`. */
export class CancelReservaMyToolDto {
  @ApiProperty({
    description: 'Localizador de la reserva (mismo valor que `reservaChatbotId` en BD).',
    example: 'CB88D9393D',
  })
  @IsString()
  @IsNotEmpty()
  localizador: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  canalVentaId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  usuarioCancela?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maquinaId?: number;
}

export class SearchReservaMyToolDto {
  @ApiProperty({ description: 'Localizador MyTool / reservaChatbotId', example: 'CB88D9393D' })
  @IsString()
  @IsNotEmpty()
  localizador: string;

  @ApiProperty({ description: 'Nombre del titular o huésped', example: 'María Pérez' })
  @IsString()
  @IsNotEmpty()
  nombre: string;
}
