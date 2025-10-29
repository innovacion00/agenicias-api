import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CotizacionesService } from './cotizaciones.service';
import { CotizacionesController } from './cotizaciones.controller';
import { CotizacionesPublicController } from './cotizaciones-public.controller';

import { Cotizacion, CotizacionSchema } from './entities/cotizacion.entity';
import { Reserva, ReservaSchema } from 'src/reservas/entities';
import { User, UserSchema } from 'src/auth/entities';
import { Agencia, AgenciaSchema } from 'src/agencias/entities';

import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { AgenciasModule } from '../agencias/agencias.module';
import { CommonModule } from 'src/common/common.module';
import { AuthModule } from 'src/auth/auth.module';
import { ReservasModule } from 'src/reservas/reservas.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cotizacion.name, schema: CotizacionSchema },
      { name: Reserva.name, schema: ReservaSchema },
      { name: User.name, schema: UserSchema },
      { name: Agencia.name, schema: AgenciaSchema },
    ]),
    CloudinaryModule,
    AgenciasModule,
    CommonModule,
    AuthModule,
    forwardRef(() => ReservasModule),
  ],
  controllers: [CotizacionesController, CotizacionesPublicController],
  providers: [CotizacionesService],
  exports: [CotizacionesService],
})
export class CotizacionesModule {}
