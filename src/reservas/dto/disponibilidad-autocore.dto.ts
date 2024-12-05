import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IdisponibilidadLayout, ValidCities } from 'src/common/interface';

class DisponibilidadLayoutDto {
  @Min(1)
  @IsNotEmpty()
  adults: number;

  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  @IsOptional()
  children_ages: number[];
}

export class DisponibilidadAutocoreDto {
  @IsString()
  @Length(10, 10)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe venir en formato YYYY-MM-DD',
  })
  @IsNotEmpty()
  checkingDate: string;

  @IsNumber()
  @Min(1)
  nigths: number;

  @IsString()
  @IsEnum(ValidCities, {
    message: (args) => {
      const validCities = Object.values(ValidCities).join(',');
      return `La ciudad ${args.value} no esta en las ciudades validad: ${validCities}.`;
    },
  })
  ciudad: ValidCities;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DisponibilidadLayoutDto)
  layout: IdisponibilidadLayout[];
}
