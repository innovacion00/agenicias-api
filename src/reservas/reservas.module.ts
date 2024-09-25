import { Module } from '@nestjs/common';

import { AuthModule } from 'src/auth/auth.module';
import { ReservasController } from './reservas.controller';

import { ReservasService } from './reservas.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Reserva, ReservaSchema } from './entities/reserva.entity';

@Module({
  controllers: [ReservasController],
  providers: [ReservasService],
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      {
        name: Reserva.name,
        schema: ReservaSchema,
      },
    ]),
  ],
})
export class ReservasModule {}
