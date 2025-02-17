import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { envs } from './config';

import { AgenciasModule } from './agencias/agencias.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { ReservasModule } from './reservas/reservas.module';
import { MyToolModule } from './my-tool/my-tool.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { IntegrationsModule } from './integrations/integrations.module';

@Module({
  imports: [
    AgenciasModule,
    AuthModule,
    CommonModule,
    IntegrationsModule,
    MongooseModule.forRoot(envs.mongoUrl),
    MyToolModule,
    NotificacionesModule,
    ReservasModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
