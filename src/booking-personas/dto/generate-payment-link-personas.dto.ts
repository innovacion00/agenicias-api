import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsPhoneNumber,
  MinLength,
  MaxLength,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreateBookingPersonaDto } from './create-booking-persona.dto';

export class GeneratePaymentLinkPersonasDto {
  @ApiProperty({
    description: 'ID del hotel en Autocore',
    example: '13645',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  hotel_id: string;

  @ApiProperty({
    description: 'Monto total a pagar',
    example: 500000,
    type: Number,
  })
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    description: 'Moneda del pago',
    example: 'COP',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({
    description: 'Nombre completo del huésped',
    example: 'Juan Pérez',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  guest_name: string;

  @ApiProperty({
    description: 'Email del huésped',
    example: 'juan@example.com',
    type: String,
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Teléfono del huésped',
    example: '+573001234567',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @IsPhoneNumber()
  phone: string;

  @ApiProperty({
    description: 'Fechas de la reserva',
    example: '2025-02-22 - 2025-02-24',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  booking_dates: string;

  @ApiProperty({
    description: 'Descripción del pago',
    example: 'Pago para reserva de 2 noches en Hotel Azuan',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Datos de la reserva para crear automáticamente después del pago',
    type: CreateBookingPersonaDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateBookingPersonaDto)
  reservation_data?: CreateBookingPersonaDto;
}

