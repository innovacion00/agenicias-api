import { Body, Controller, Get, Post } from '@nestjs/common';
import { EventosService } from './eventos.service';
import { CreateReservaEventoDto } from './dto';
import { Auth, GetUser } from 'src/auth/decorators';
import { Types } from 'mongoose';
import { ValidRoles } from 'src/auth/interfaces';
import { ParseCreateEventoPipe } from './pipes';

@Controller('eventos')
export class EventosController {
  constructor(private readonly eventosService: EventosService) {}

  @Post('create')
  @Auth()
  createEventoReserva(
    @Body(new ParseCreateEventoPipe())
    createEventoReservaDto: CreateReservaEventoDto,
    @GetUser('_id') _id: Types.ObjectId,
  ) {
    return this.eventosService.createEventoReserva(createEventoReservaDto, _id);
  }

  @Get()
  @Auth(ValidRoles.eventosSuperAdmin, ValidRoles.superAdmin)
  getEventos() {
    return this.eventosService.getEventos();
  }
}
