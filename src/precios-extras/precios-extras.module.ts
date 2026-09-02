import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'src/auth/auth.module';
import {
  PrecioExtra,
  PrecioExtraSchema,
} from './entities/precio-extra.entity';
import { PreciosExtrasController } from './precios-extras.controller';
import { PreciosExtrasPublicController } from './precios-extras-public.controller';
import { PreciosExtrasService } from './precios-extras.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: PrecioExtra.name, schema: PrecioExtraSchema },
    ]),
  ],
  controllers: [PreciosExtrasController, PreciosExtrasPublicController],
  providers: [PreciosExtrasService],
  exports: [PreciosExtrasService],
})
export class PreciosExtrasModule {}