import { Module } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionesController } from './notificaciones.controller';
import { CommonModule } from 'src/common/common.module';
import { ReservasModule } from 'src/reservas/reservas.module';

@Module({
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
  imports: [CommonModule, ReservasModule],
})
export class NotificacionesModule {}
