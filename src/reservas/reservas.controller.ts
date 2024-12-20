import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  Query,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ReservasService } from './reservas.service';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { ParseMongoIdPipe } from 'src/common/pipes';
import {
  DisponibilidadAutocoreDto,
  GenerateLinkDto,
} from './dto';
import { Auth, GetUser } from 'src/auth/decorators';

@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  @Post('reservar')
  @Auth()
  create(
    @Body() createReservaDto: CreateReservaDto,
    @Query('hotelId') hotelId: string,
    @GetUser('_id') _id: string,
  ) {
    return this.reservasService.createReserva(createReservaDto, hotelId, _id);
  }

  @Post('/change-status')
  cambiarEstadoPagoReserva(@Body() genericDto: any) {
    return this.reservasService.cambiarEstadoPagoReserva(genericDto);
  }

  @Get('/reservas-by-user')
  @Auth()
  getReservasByUser(@GetUser('_id') _id: Types.ObjectId) {
    return this.reservasService.getReservasByUser(_id);
  }

  @Post('/generate-link')
  @Auth()
  generateLinkPago(
    @GetUser('agencia') agencia: Types.ObjectId,
    @Body() generateLinkDto: GenerateLinkDto,
  ) {
    return this.reservasService.generarLinkPago(generateLinkDto, agencia);
  }

  @Post('disponibilidad/:agenciaId')
  @HttpCode(200)
  getDisponibilidad(
    @Param('agenciaId', ParseMongoIdPipe) agenciaId: Types.ObjectId,
    @Body() disponibilidadAutoCoreDto: DisponibilidadAutocoreDto,
  ) {
    return this.reservasService.getDisponibilidad(
      agenciaId,
      disponibilidadAutoCoreDto,
    );
  }
}
