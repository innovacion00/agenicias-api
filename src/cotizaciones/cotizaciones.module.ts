import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CotizacionesService } from './cotizaciones.service';
import { CotizacionesController } from './cotizaciones.controller';
import { CotizacionesPublicController } from './cotizaciones-public.controller';
import { Cotizacion, CotizacionSchema } from './entities/cotizacion.entity';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { AgenciasModule } from 'src/agencias/agencias.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [CotizacionesController, CotizacionesPublicController],
  providers: [CotizacionesService],
  imports: [
    MongooseModule.forFeature([
      {
        name: Cotizacion.name,
        schema: CotizacionSchema,
      },
    ]),
    CloudinaryModule,
    AgenciasModule,
    AuthModule,
  ],
  exports: [CotizacionesService, MongooseModule],
})
export class CotizacionesModule {}
