import {
  BadRequestException,
  Controller,
  Post,
  Body,
  HttpCode,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { BookingPersonasService } from './booking-personas.service';
import { DisponibilidadPersonasDto } from './dto/disponibilidad-personas.dto';
import { StaticTokenAuth } from 'src/auth/decorators';
import { CreateBookingPersonaDto } from './dto/create-booking-persona.dto';
import { ParseHotelIdPipe } from 'src/reservas/pipes';
import { GeneratePaymentLinkPersonasDto } from './dto/generate-payment-link-personas.dto';

@ApiTags('booking-personas')
@Controller('booking-personas')
export class BookingPersonasController {
  constructor(private readonly bookingPersonasService: BookingPersonasService) {}

  @Post('disponibilidad')
  @StaticTokenAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Consultar disponibilidad de hoteles para personas' })
  @ApiResponse({ status: 200, description: 'Disponibilidad consultada exitosamente' })
  @ApiResponse({ status: 401, description: 'Token de autenticación inválido o faltante' })
  getDisponibilidad(
    @Body() disponibilidadPersonasDto: DisponibilidadPersonasDto,
  ) {
    return this.bookingPersonasService.getDisponibilidad(
      disponibilidadPersonasDto,
    );
  }

  @Post('generar-link-pago')
  @StaticTokenAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Generar link de pago para reserva de personas' })
  @ApiResponse({ status: 200, description: 'Link de pago generado exitosamente' })
  @ApiResponse({ status: 401, description: 'Token de autenticación inválido o faltante' })
  generarLinkPago(
    @Body() generatePaymentLinkDto: GeneratePaymentLinkPersonasDto,
    @Query('hotelId', ParseHotelIdPipe) hotelId: string,
  ) {
    return this.bookingPersonasService.generarLinkPago(
      generatePaymentLinkDto,
      hotelId,
    );
  }

  @Post('reservar')
  @StaticTokenAuth()
  @HttpCode(201)
  @ApiOperation({ summary: 'Crear una nueva reserva de hotel para personas (requiere pago previo)' })
  @ApiResponse({ status: 201, description: 'Reserva creada exitosamente' })
  @ApiResponse({ status: 401, description: 'Token de autenticación inválido o faltante' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o pago no completado' })
  createReserva(
    @Body() createBookingPersonaDto: CreateBookingPersonaDto,
    @Query('hotelId', ParseHotelIdPipe) hotelId: string,
    @Query('paymentCode') paymentCode: string,
  ) {
    if (!paymentCode) {
      throw new BadRequestException(
        'El código de pago es requerido. Primero genera un link de pago y completa el pago.',
      );
    }
    return this.bookingPersonasService.createReserva(
      createBookingPersonaDto,
      hotelId,
      paymentCode,
    );
  }

  @Post('change-status')
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook para cambio de estado de pago (Autocore)' })
  cambiarEstadoPagoReserva(
    @Body()
    payload: {
      external_ref_id: string;
      transaction_id?: string;
      payment_status: string;
      details: {
        id: string;
        pay_platform?: string;
      };
    },
  ) {
    return this.bookingPersonasService.cambiarEstadoPagoAutocore(payload);
  }
}
