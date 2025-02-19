import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { envs } from './config';

import { AgenciasModule } from './agencias/agencias.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { ReservasModule } from './reservas/reservas.module';
import { MyToolModule } from './my-tool/my-tool.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { FilesModule } from './files/files.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';

@Module({
  imports: [
    AgenciasModule,
    AuthModule,
    CommonModule,
    ConfigModule.forRoot({ isGlobal: true }),
    FilesModule,
    IntegrationsModule,
    MongooseModule.forRoot(envs.mongoUrl),
    MyToolModule,
    NotificacionesModule,
    ReservasModule,
    CloudinaryModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
