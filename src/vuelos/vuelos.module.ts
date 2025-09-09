import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VuelosController } from './vuelos.controller';
import { VuelosService } from './vuelos.service';
import { AmadeusService } from './amadeus.service';
import { ErrorHandlerService } from './services/error-handler.service';
import { ErrorHandlerInterceptor } from './interceptors/error-handler.interceptor';
import { ErrorHandlerFilter } from './filters/error-handler.filter';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    ConfigModule,
    CommonModule, // Para acceder a HttpCustomService
  ],
  controllers: [VuelosController],
  providers: [
    VuelosService, 
    AmadeusService, 
    ErrorHandlerService,
    ErrorHandlerInterceptor,
    ErrorHandlerFilter
  ],
  exports: [VuelosService, AmadeusService, ErrorHandlerService],
})
export class VuelosModule {}
