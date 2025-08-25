import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VuelosController } from './vuelos.controller';
import { VuelosService } from './vuelos.service';
import { AmadeusService } from './amadeus.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    ConfigModule,
    CommonModule, // Para acceder a HttpCustomService
  ],
  controllers: [VuelosController],
  providers: [VuelosService, AmadeusService],
  exports: [VuelosService, AmadeusService],
})
export class VuelosModule {}
