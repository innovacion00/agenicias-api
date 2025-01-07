import { Controller, Post } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';

@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Post()
  notificacionPago() {
    return this.notificacionesService.notificacionPago();
  }
}
