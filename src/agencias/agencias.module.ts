import { Module } from '@nestjs/common';
import { AgenciasService } from './agencias.service';
import { AgenciasController } from './agencias.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Agencia, AgenciaSchema } from './entities';
import { CommonModule } from 'src/common/common.module';

@Module({
  controllers: [AgenciasController],
  providers: [AgenciasService],
  imports: [
    CommonModule,
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
