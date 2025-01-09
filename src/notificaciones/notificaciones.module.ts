import { Module } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionesController } from './notificaciones.controller';
import { CommonModule } from 'src/common/common.module';
import { ReservasModule } from 'src/reservas/reservas.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
  imports: [CommonModule, ReservasModule, AuthModule],
})
export class NotificacionesModule {}
