import { Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificacionesService } from './notificaciones.service';

@ApiTags('notificaciones')
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Post('/reservas')
  @ApiOperation({
    summary: 'Enviar notificación de pago de reserva',
    description:
      'Dispara el flujo de notificaciones relacionado con pagos de reservas.',
  })
  notificacionPago() {
    return this.notificacionesService.notificacionPago();
  }
}
