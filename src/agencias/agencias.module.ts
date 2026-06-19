import { forwardRef, Module } from '@nestjs/common';
import { AgenciasService } from './agencias.service';
import { AgenciasController } from './agencias.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Agencia, AgenciaSchema } from './entities';
import { CommonModule } from 'src/common/common.module';
import { AutocoreModule } from 'src/autocore/autocore.module';
import { CobreModule } from 'src/cobre/cobre.module';
import { AuthModule } from 'src/auth/auth.module';
import { ReservasModule } from 'src/reservas/reservas.module';
import { MaarlabCredentialsModule } from 'src/maarlab-credentials/maarlab-credentials.module';

@Module({
  controllers: [AgenciasController],
  providers: [AgenciasService],
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => ReservasModule),
    CommonModule,
    AutocoreModule,
    CobreModule,
    MaarlabCredentialsModule,
    MongooseModule.forFeature([{ name: Agencia.name, schema: AgenciaSchema }]),
  ],
  exports: [AgenciasService, MongooseModule],
})
export class AgenciasModule {}
