import { Controller, Post } from '@nestjs/common';
import { EventosService } from './eventos.service';

@Controller('eventos')
export class EventosController {
  constructor(private readonly eventosService: EventosService) {}

  @Post('create')
  createEventoReserva() {
    return this.eventosService.createEventoReserva();
  }
}
