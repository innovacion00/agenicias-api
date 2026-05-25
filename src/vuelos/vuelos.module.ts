import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { VuelosController } from './vuelos.controller';
import { MaarlabWebhookController } from './maarlab-webhook.controller';
import { VuelosService } from './vuelos.service';
import { AmadeusService } from './amadeus.service';
import { MaarLabService } from './maarlab.service';
import { FlightEnrichmentService } from './services/flight-enrichment.service';
import { MaarlabWebhookService } from './services/maarlab-webhook.service';
import { ErrorHandlerService } from './services/error-handler.service';
import { ErrorHandlerInterceptor } from './interceptors/error-handler.interceptor';
import { ErrorHandlerFilter } from './filters/error-handler.filter';
import { CommonModule } from '../common/common.module';
import { Reserva, ReservaSchema } from 'src/reservas/entities';
import { Agencia, AgenciaSchema } from 'src/agencias/entities';
import { User, UserSchema } from 'src/auth/entities';
import { AgenciasModule } from 'src/agencias/agencias.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    ConfigModule,
    CommonModule, // Para acceder a HttpCustomService
    MongooseModule.forFeature([
      { name: Reserva.name, schema: ReservaSchema },
      { name: Agencia.name, schema: AgenciaSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
    AgenciasModule,
  ],
  controllers: [VuelosController, MaarlabWebhookController],
  providers: [
    VuelosService,
    MaarlabWebhookService,
    AmadeusService,
    MaarLabService,
    FlightEnrichmentService,
    ErrorHandlerService,
    ErrorHandlerInterceptor,
    ErrorHandlerFilter
  ],
  exports: [VuelosService, AmadeusService, MaarLabService, ErrorHandlerService],
})
export class VuelosModule {}
