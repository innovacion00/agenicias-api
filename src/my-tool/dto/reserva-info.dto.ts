import { IsNotEmpty, IsString } from 'class-validator';

export class ReservaInfoDto {
  @IsString()
  @IsNotEmpty()
  localizador: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  // @IsString()
  // @IsNotEmpty()
  // hotel: string;
}
