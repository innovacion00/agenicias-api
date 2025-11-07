import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'Email del usuario',
    example: 'usuario@ejemplo.com',
    type: String,
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'Juan Pérez',
    type: String,
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    description: 'Teléfono del usuario (debe empezar con +)',
    example: '+573001234567',
    type: String,
    minLength: 7,
    maxLength: 15,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(7)
  @MaxLength(15)
  @Matches(/^\+[0-9]+$/, {
    message:
      'El teléfono solo puede contener dígitos y debe de tener un + al inicio.',
  })
  telefono: string;

  @ApiProperty({
    description: 'Omitir verificación OTP',
    example: false,
    type: Boolean,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  omitirOtp: boolean;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'Password123!',
    type: String,
    minLength: 6,
    maxLength: 50,
  })
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
