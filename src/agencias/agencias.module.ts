import { Module } from '@nestjs/common';
import { AgenciasService } from './agencias.service';
import { AgenciasController } from './agencias.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Agencia, AgenciaSchema } from './entities';

@Module({
  controllers: [AgenciasController],
  providers: [AgenciasService],
  imports: [
    MongooseModule.forFeature([
      {
        name: Agencia.name,
        schema: AgenciaSchema,
      },
    ]),
  ],
  exports: [MongooseModule],
})
export class AgenciasModule {}
