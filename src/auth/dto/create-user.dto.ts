import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

class ValidacionDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @Matches(/^\S*$/, { message: 'palabra no puede contener espacios.' })
  palabra: string;

  @IsString()
  @MinLength(3)
  pista: string;
}

class DocumentDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['CC', 'NIT', 'CA', 'PA'])
  tipo: 'CC' | 'NIT' | 'CA' | 'PA';

  @IsString()
  @MinLength(6)
  @Matches(/^[^\s._]+$/, {
    message:
      'document no puede contener espacios, puntos o guiones bajos.',
  })
  document: string;
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
  @Matches(/^\+?[0-9]+$/, {
    message:
      'El teléfono solo puede contener dígitos y opcionalmente un + al inicio.',
  })
  telefono: string;

  @ValidateNested()
  @IsNotEmpty()
  @Type(() => ValidacionDto)
  validacion: {
    palabra: string;
    pista: string;
  };

  @ValidateNested()
  @IsNotEmpty()
  @Type(() => DocumentDto)
  documentInfo: {
    tipo: 'CC' | 'NIT' | 'CA' | 'PA';
    document: string;
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
