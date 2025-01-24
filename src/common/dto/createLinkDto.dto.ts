import {
  ArrayNotEmpty,
  IsNotEmpty,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateLinkDto {

  @IsNotEmpty()
  @IsString()
  @MaxLength(15)
  @MinLength(4)
  @Matches(/^[0-9]+$/, {
    message: 'El campo amount solo puede contener números.',
  })
  amount: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'El campo expirationDate debe seguir el formato YYYY-MM-DD.',
  })
  expirationDate: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(100)
  description: string;

  @IsNotEmpty()
  @ArrayNotEmpty()
  @IsString({ each: true, message: 'Reference deben ser string' })
  references: string[];

  @IsUrl()
  @IsNotEmpty()
  redirectUrl: string;
}
