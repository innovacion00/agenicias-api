import { Body, Controller, Get, Post } from '@nestjs/common';
import { EventosService } from './eventos.service';
import { CreateReservaEventoDto } from './dto';
import { Auth, GetUser } from 'src/auth/decorators';
import { Types } from 'mongoose';
import { ValidRoles } from 'src/auth/interfaces';

@Controller('eventos')
export class EventosController {
  constructor(private readonly eventosService: EventosService) {}

  @Post('create')
  @Auth()
  createEventoReserva(
    @Body() createEventoReservaDto: CreateReservaEventoDto,
    @GetUser('_id') _id: Types.ObjectId,
  ) {
    return this.eventosService.createEventoReserva(createEventoReservaDto, _id);
  }

  @Get()
  @Auth(ValidRoles.eventosSuperAdmin)
  getEventos() {
    return this.eventosService.getEventos();
  }
}
