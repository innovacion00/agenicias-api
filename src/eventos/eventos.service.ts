import { Injectable, Logger } from '@nestjs/common';
import { ErrorManager } from 'src/common/helpers';

@Injectable()
export class EventosService {
  private readonly errorManager = new ErrorManager(EventosService.name);
  private readonly logger = new Logger(EventosService.name);
  constructor() {}

  createEventoReserva() {
    return {
      hola: 'Mundo eventos',
    };
  }
}
