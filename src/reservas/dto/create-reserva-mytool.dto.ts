import {
  IsArray,
  IsBoolean,
  IsEmail,
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
import { IAsistente, ITitularInfo } from '../interfaces';
import { InfoTransporteDto, InfoTouresDto } from './create-reserva.dto';

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
  @Matches(/^\d{4}-\d{2}-\d{2}/, {
    message: 'birthDay debe estar en formato YYYY-MM-DD',
  })
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
}

export class MyToolRoomDto {
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
  @Type(() => MyToolGuestDto)
  guest: MyToolGuestDto[];
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

export class CreateReservaMyToolDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  titular: string;

  @IsString()
  @IsNotEmpty()
  telefono: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MyToolRoomDto)
  rooms: MyToolRoomDto[];

  @ValidateNested()
  @Type(() => TitularInfoDto)
  @IsNotEmpty()
  titularInfo: ITitularInfo;

  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  total: number;

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

export class CancelReservaMyToolDto {
  @IsString()
  @IsNotEmpty()
  reservaId: string;
}

export class SearchReservaMyToolDto {
  @IsString()
  @IsNotEmpty()
  localizador: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;
}
