import { Module } from '@nestjs/common';
import { EventosService } from './eventos.service';
import { EventosController } from './eventos.controller';
import { AuthModule } from 'src/auth/auth.module';
import { CommonModule } from 'src/common/common.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Evento, EventoSchema } from './entities';

@Module({
  controllers: [EventosController],
  providers: [EventosService],
  imports: [
    AuthModule,
    CommonModule,
    MongooseModule.forFeature([
      {
        name: Evento.name,
        schema: EventoSchema,
      },
    ]),
  ],
})
export class EventosModule {}
