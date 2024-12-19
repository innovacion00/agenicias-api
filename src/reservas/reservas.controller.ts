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
import { DisponibilidadAutocoreDto } from './dto';

@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  @Post('reservar')
  create(
    @Body() createReservaDto: CreateReservaDto,
    @Query('hotelId') hotelId: string,
  ) {
    return this.reservasService.create(createReservaDto, hotelId);
  }

  @Get('/:userId')
  getReservasByUser(@Param('userId') userId: string) {
    return this.reservasService.getReservasByUser(userId);
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
