import {
  IsMongoId,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ValidarPalabraDto {
  @IsMongoId()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(10)
  @Matches(/^\S*$/, { message: 'palabra no puede contener espacios.' })
  palabra: string;
}
