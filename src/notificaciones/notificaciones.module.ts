import { Module } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionesController } from './notificaciones.controller';
import { CommonModule } from 'src/common/common.module';
import { AutocoreModule } from 'src/autocore/autocore.module';
import { ReservasModule } from 'src/reservas/reservas.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
  imports: [CommonModule, AutocoreModule, ReservasModule, AuthModule],
})
export class NotificacionesModule {}
