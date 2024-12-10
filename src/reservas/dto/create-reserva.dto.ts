import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Types } from 'mongoose';
import {
  Agency,
  IreservaInfo,
  IreservaInfoBd,
  RoomsDatum,
} from '../interfaces';
import { Type } from 'class-transformer';
import { ValidCities } from 'src/common/interface';

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
  @IsNotEmpty()
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
  @IsNotEmpty()
  children: string;

  @IsString()
  @IsNotEmpty()
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

export class CreateReservaDto {
  @IsMongoId()
  @IsNotEmpty()
  userId: Types.ObjectId;

  @ValidateNested()
  @Type(() => ReservaInfoDto)
  @IsNotEmpty()
  reservaInfo: IreservaInfo;
}
