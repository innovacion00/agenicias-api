import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';

import { envs } from 'src/config';
import { RedisModule } from 'src/redis/redis.module';
import { CommonModule } from 'src/common/common.module';
import { NotificacionesModule } from 'src/notificaciones/notificaciones.module';
import { BotReservasPendientesModule } from 'src/bot-reservas-pendientes/bot-reservas-pendientes.module';
import { ReservasModule } from 'src/reservas/reservas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: 'info',
        transport: undefined,
      },
    }),
    MongooseModule.forRoot(envs.mongoUrl, {
      maxPoolSize: 10,
      minPoolSize: 2,
      retryWrites: true,
      retryReads: true,
    }),
    ScheduleModule.forRoot(),
    RedisModule,
    CommonModule,
    NotificacionesModule,
    BotReservasPendientesModule,
    ReservasModule,
  ],
})
export class WorkerModule {}
