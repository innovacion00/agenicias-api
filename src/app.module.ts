import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { envs } from './config';

import { AgenciasModule } from './agencias/agencias.module';
import { AuthModule } from './auth/auth.module';
import { BotReservasPendientesModule } from './bot-reservas-pendientes/bot-reservas-pendientes.module';
import { CommonModule } from './common/common.module';
import { ReservasModule } from './reservas/reservas.module';
import { MyToolModule } from './my-tool/my-tool.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { FilesModule } from './files/files.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { EventosModule } from './eventos/eventos.module';
import { VuelosModule } from './vuelos/vuelos.module';
import { CotizacionesModule } from './cotizaciones/cotizaciones.module';

@Module({
  imports: [
    AgenciasModule,
    AuthModule,
    BotReservasPendientesModule,
    CommonModule,
    ConfigModule.forRoot({ isGlobal: true }),
    FilesModule,
    IntegrationsModule,
    MongooseModule.forRoot(envs.mongoUrl),
    MyToolModule,
    NotificacionesModule,
    ReservasModule,
    CloudinaryModule,
    EventosModule,
    VuelosModule,
    CotizacionesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
