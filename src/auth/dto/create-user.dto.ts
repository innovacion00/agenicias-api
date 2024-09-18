import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

class ValidacionDto {
  @IsString()
  palabra: string;

  @IsString()
  pista: string;
}

export class CreateUSerDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(2)
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(7)
  @MaxLength(15)
  @Matches(/^\+?[0-9\s\-]+$/)
  telefono: string;

  @ValidateNested()
  @IsNotEmpty()
  @Type(() => ValidacionDto)
  validacion: {
    palabra: string;
    pista: string;
  };

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(50)
  @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'La contraseña debe de tener por lo menos una mayúscula, una minúscula y un número.',
  })
  password: string;
}
