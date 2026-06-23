import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BotReservasPendientesService } from './bot-reservas-pendientes.service';
import { BotReservasPendientesController } from './bot-reservas-pendientes.controller';
import { Reserva, ReservaSchema } from '../reservas/entities';
import { Agencia, AgenciaSchema } from '../agencias/entities';
import { User, UserSchema } from '../auth/entities';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Reserva.name, schema: ReservaSchema },
      { name: Agencia.name, schema: AgenciaSchema },
      { name: User.name, schema: UserSchema },
    ]),
    CommonModule,
  ],
  controllers: [BotReservasPendientesController],
  providers: [BotReservasPendientesService],
  exports: [BotReservasPendientesService],
})
export class BotReservasPendientesModule {}
