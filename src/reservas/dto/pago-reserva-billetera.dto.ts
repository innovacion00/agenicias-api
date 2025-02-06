import { IsNotEmpty, IsString } from 'class-validator';

export class PagoReservaBilleteraDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}
