import { Module } from '@nestjs/common';
import { EventosService } from './eventos.service';
import { EventosController } from './eventos.controller';
import { AuthModule } from 'src/auth/auth.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  controllers: [EventosController],
  providers: [EventosService],
  imports:[
    AuthModule,
    CommonModule
    // TODO: Mongo base de datos
  ]
})
export class EventosModule {}
