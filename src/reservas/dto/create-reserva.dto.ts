import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Types } from 'mongoose';

import { Type } from 'class-transformer';
import {
  Agency,
  IreservaInfo,
  IreservaInfoBd,
  RoomsDatum,
  ValidCities,
} from 'src/common/interface';
import { IAsistente } from '../interfaces';

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
  adults: string;

  @IsString()
  children: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'checkin debe venir en formato YYYY-MM-DD',
  })
  checkin: Date;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'checkin debe venir en formato YYYY-MM-DD',
  })
  checkout: Date;

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
  @Min(10000)
  unitaryPrice: number;
}

class ReservaInfoDbDto {
  @IsString()
  @IsNotEmpty()
  adults: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'checkin debe venir en formato YYYY-MM-DD',
  })
  checkin: Date;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'checkout debe venir en formato YYYY-MM-DD',
  })
  checkout: Date;

  @IsString()
  children: string;

  @IsString()
  children_ages: string;

  @IsEnum(ValidCities, {
    message: (args) => {
      const validCities = Object.values(ValidCities).join(',');
      return `city ${args.value} no esta en las ciudades validad: ${validCities}.`;
    },
  })
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
  @IsPhoneNumber()
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

export class CreateReservaDto {
  @IsNumber()
  @IsNotEmpty()
  total: number;

  @ValidateNested()
  @Type(() => AsistenteDto)
  @IsOptional()
  asistentes: IAsistente[];

  @ValidateNested()
  @Type(() => ReservaInfoDto)
  @IsNotEmpty()
  reservaInfo: IreservaInfo;
}
