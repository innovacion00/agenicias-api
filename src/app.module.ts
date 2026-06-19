import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';

import { envs } from './config';
import { GlobalExceptionFilter } from './common/filters';

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
import { BookingPersonasModule } from './booking-personas/booking-personas.module';
import { ReferenciaAeropuertosModule } from './referencia-aeropuertos/referencia-aeropuertos.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { RedisThrottlerStorage } from './redis/redis-throttler-storage.service';

@Module({
  imports: [
    AgenciasModule,
    AuthModule,
    BotReservasPendientesModule,
    CommonModule,
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    RedisModule,
    // Logging estructurado con Pino
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        // correlationId real por petición (reemplaza el contador por proceso
        // de pino-http); el GlobalExceptionFilter lo expone como correlationId
        genReqId: () => randomUUID(),
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: false,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname',
                },
              }
            : undefined,
        serializers: {
          req: (req: any) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            query: req.query,
            params: req.params,
            headers: {
              host: req.headers.host,
              'user-agent': req.headers['user-agent'],
              'content-type': req.headers['content-type'],
            },
          }),
          res: (res: any) => ({
            statusCode: res.statusCode,
          }),
          err: (err: any) => ({
            type: err.type,
            message: err.message,
            stack: err.stack,
          }),
        },
        customProps: (req: any) => ({
          context: 'HTTP',
        }),
        autoLogging: {
          ignore: (req: any) => {
            // Ignorar logging de health checks y favicon
            return req.url === '/health' || req.url === '/favicon.ico';
          },
        },
      },
    }),
    FilesModule,
    IntegrationsModule,
    MongooseModule.forRoot(envs.mongoUrl, {
      maxPoolSize: 30,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000, // Timeout para seleccionar servidor
      socketTimeoutMS: 45000, // Timeout para operaciones de socket
      heartbeatFrequencyMS: 10000, // Frecuencia de heartbeat
      retryWrites: true, // Reintentar escrituras fallidas
      retryReads: true, // Reintentar lecturas fallidas
      // Para producción con réplicas, descomentar:
      // readPreference: 'secondaryPreferred', // Leer de réplicas secundarias cuando sea posible
    }),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        storage,
        throttlers: [
          { name: 'short', ttl: 60000, limit: 100 },
          { name: 'medium', ttl: 600000, limit: 500 },
          { name: 'long', ttl: 3600000, limit: 2000 },
        ],
      }),
    }),
    MyToolModule,
    NotificacionesModule,
    ReservasModule,
    CloudinaryModule,
    EventosModule,
    VuelosModule,
    CotizacionesModule,
    BookingPersonasModule,
    ReferenciaAeropuertosModule,
  ],
  controllers: [],
  providers: [
    RedisThrottlerStorage,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Filtro global de excepciones (superset compatible: añade
    // correlationId/timestamp/path sin cambiar statusCode ni message).
    // El filtro local de VuelosController (@UseFilters) gana por precedencia.
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
