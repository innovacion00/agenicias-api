import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'src/auth/auth.module';
import {
  AeropuertoReferencia,
  AeropuertoReferenciaSchema,
} from './entities/aeropuerto-referencia.entity';
import { ReferenciaAeropuertosController } from './referencia-aeropuertos.controller';
import { ReferenciaAeropuertosService } from './referencia-aeropuertos.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: AeropuertoReferencia.name, schema: AeropuertoReferenciaSchema },
    ]),
  ],
  controllers: [ReferenciaAeropuertosController],
  providers: [ReferenciaAeropuertosService],
  exports: [ReferenciaAeropuertosService],
})
export class ReferenciaAeropuertosModule {}
