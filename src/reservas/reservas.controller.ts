import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
} from '@nestjs/common';
import { ReservasService } from './reservas.service';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { ParseMongoIdPipe } from 'src/common/pipes';
import { DisponibilidadAutocoreDto } from './dto';
import { ObjectId } from 'mongoose';

@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  @Post()
  create(@Body() createReservaDto: CreateReservaDto) {
    return this.reservasService.create(createReservaDto);
  }

  @Post('disponibilidad/:agenciaId')
  @HttpCode(200)
  getDisponibilidad(
    @Param('agenciaId', ParseMongoIdPipe) agenciaId: ObjectId,
    @Body() disponibilidadAutoCoreDto: DisponibilidadAutocoreDto,
  ) {
    return this.reservasService.getDisponibilidad(
      agenciaId,
      disponibilidadAutoCoreDto,
    );
  }
}
