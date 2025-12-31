import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { BookingPersonasController } from './booking-personas.controller';
import { BookingPersonasService } from './booking-personas.service';
import { CommonModule } from 'src/common/common.module';
import { StaticTokenGuard } from 'src/auth/guards';
import { BookingPersona, BookingPersonaSchema } from './entities/booking-persona.entity';
import { PaymentPending, PaymentPendingSchema } from './entities/payment-pending.entity';

@Module({
  controllers: [BookingPersonasController],
  providers: [BookingPersonasService, StaticTokenGuard],
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      {
        name: BookingPersona.name,
        schema: BookingPersonaSchema,
      },
      {
        name: PaymentPending.name,
        schema: PaymentPendingSchema,
      },
    ]),
  ],
  exports: [BookingPersonasService, MongooseModule],
})
export class BookingPersonasModule {}

