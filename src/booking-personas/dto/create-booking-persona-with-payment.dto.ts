import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateBookingPersonaDto } from './create-booking-persona.dto';

export class CreateBookingPersonaWithPaymentDto extends CreateBookingPersonaDto {
  @ApiProperty({
    description:
      'Código del link de pago de Autocore (obtenido después de pagar)',
    example: 'PAYMENT_CODE_12345',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  payment_code: string;
}
