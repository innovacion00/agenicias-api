import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthModule } from 'src/auth/auth.module';
import { ReservasController } from './reservas.controller';
import { ReservasService } from './reservas.service';
import { Reserva, ReservaSchema } from './entities/reserva.entity';
import { CommonModule } from 'src/common/common.module';
import { AgenciasModule } from 'src/agencias/agencias.module';
import { CancellationTasksQueueService } from './cancellation-tasks-queue.service';
import { CancellationLockReconciliationService } from './cancellation-lock-reconciliation.service';
import { MyToolBookingService } from './services/my-tool-booking.service';
import { ReservasSearchService } from './services/reservas-search.service';
import { ReservasCountCacheService } from './services/reservas-count-cache.service';
import { ReservasBookingService } from './services/reservas-booking.service';
import { ReservasReactivacionService } from './services/reservas-reactivacion.service';
import { LinksPagoService } from './services/links-pago.service';
import { ReservasPagosService } from './services/reservas-pagos.service';
import { ReservasEmailsService } from './services/reservas-emails.service';
import { AutocoreModule } from 'src/autocore/autocore.module';

@Module({
  controllers: [ReservasController],
  providers: [
    ReservasService,
    CancellationTasksQueueService,
    CancellationLockReconciliationService,
    MyToolBookingService,
    ReservasSearchService,
    ReservasCountCacheService,
    ReservasBookingService,
    ReservasReactivacionService,
    LinksPagoService,
    ReservasPagosService,
    ReservasEmailsService,
  ],
  imports: [
    forwardRef(() => AgenciasModule),
    AuthModule,
    CommonModule,
    AutocoreModule,
    MongooseModule.forFeature([
      {
        name: Reserva.name,
        schema: ReservaSchema,
      },
    ]),
  ],
  exports: [MongooseModule, ReservasService],
})
export class ReservasModule {}
