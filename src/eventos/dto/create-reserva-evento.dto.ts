import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TipoAcomodacion, TipoEvento } from '../interfaces';

class HorarioEventoDto {
  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  fechaInicio: string;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  fechaFinal: string;

  @IsNumber()
  @IsNotEmpty()
  cantidadAsistenteDia: number;
}

class AlimentoBebidasDto {
  @IsBoolean()
  @IsNotEmpty()
  @IsOptional()
  estacionCafe?: boolean;
  @IsBoolean()
  @IsNotEmpty()
  @IsOptional()
  coffeBreak?: boolean;
  @IsBoolean()
  @IsNotEmpty()
  @IsOptional()
  desayuno?: boolean;
  @IsBoolean()
  @IsNotEmpty()
  @IsOptional()
  almuerzo?: boolean;
  @IsBoolean()
  @IsNotEmpty()
  @IsOptional()
  cena?: boolean;
}

export class CreateReservaEventoDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  nameEvento: string;

  @IsEnum(TipoEvento, {
    message: `El tipo de evento debe de ser: Evento Corporativo = 1, Evento social = 2, Evento cultural = 3.`,
  })
  @IsNumber()
  @IsNotEmpty()
  tipoEvento: number;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  nombreOrganizador: string;

  @IsNumber()
  @IsNotEmpty()
  cantidadAsistentes: number;

  @IsString()
  @IsNotEmpty()
  @MinLength(7)
  @MaxLength(15)
  @IsPhoneNumber()
  telefonoOrganizador: string;

  @IsEmail()
  @IsNotEmpty()
  emailOrganizador: string;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  fechaInicioEvento: string;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  fechaFinalEvento: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HorarioEventoDto)
  horarioEvento: HorarioEventoDto[];

  @IsBoolean()
  @IsOptional()
  flexibilidadEvento?: boolean;

  @IsEnum(TipoAcomodacion, {
    message: `El tipo de acomodacion debe de ser alguna de las siguientes: auditorio = 1, Aula o salon = 2, Mesa cuadrada = 3, Mesa redonda = 4, Mesas tipo U = 5,`,
  })
  @IsNumber()
  @IsNotEmpty()
  tipoAcomodacion: TipoAcomodacion;

  @IsBoolean()
  @IsNotEmpty()
  @IsOptional()
  alimentacion?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => AlimentoBebidasDto)
  alimentosBebidas?: AlimentoBebidasDto;

  @IsBoolean()
  @IsNotEmpty()
  @IsOptional()
  audiovisuales?: boolean;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  itemsAudiovisuales?: string[];

  @IsBoolean()
  @IsNotEmpty()
  @IsOptional()
  decoracion?: boolean;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  decoracionDescripcion?: string;

  @IsBoolean()
  @IsNotEmpty()
  @IsOptional()
  alojamiento?: boolean;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  observaciones?: string;
}
