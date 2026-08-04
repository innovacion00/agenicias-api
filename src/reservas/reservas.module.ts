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
import { AutocoreWebhookEventService } from './services/autocore-webhook-event.service';
import { PaymentWebhookReconciliationService } from './services/payment-webhook-reconciliation.service';
import {
  AutocoreWebhookEvent,
  AutocoreWebhookEventSchema,
} from './entities/autocore-webhook-event.entity';

@Module({
  controllers: [ReservasController],
  providers: [
    ReservasService,
    CancellationTasksQueueService,
    CancellationLockReconciliationService,
    MyToolBookingService,
    AutocoreWebhookEventService,
    PaymentWebhookReconciliationService,
  ],
  imports: [
    forwardRef(() => AgenciasModule),
    AuthModule,
    CommonModule,
    MongooseModule.forFeature([
      {
        name: Reserva.name,
        schema: ReservaSchema,
      },
      {
        name: AutocoreWebhookEvent.name,
        schema: AutocoreWebhookEventSchema,
      },
    ]),
  ],
  exports: [MongooseModule, ReservasService],
})
export class ReservasModule {}
