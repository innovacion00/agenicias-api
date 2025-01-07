import { Module } from '@nestjs/common';

import { AuthModule } from 'src/auth/auth.module';
import { ReservasController } from './reservas.controller';

import { ReservasService } from './reservas.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Reserva, ReservaSchema } from './entities/reserva.entity';
import { CommonModule } from 'src/common/common.module';
import { AgenciasModule } from 'src/agencias/agencias.module';

@Module({
  controllers: [ReservasController],
  providers: [ReservasService],
  imports: [
    AgenciasModule,
    AuthModule,
    CommonModule,
    MongooseModule.forFeature([
      {
        name: Reserva.name,
        schema: ReservaSchema,
      },
    ]),
  ],
  exports: [MongooseModule],
})
export class ReservasModule {}
