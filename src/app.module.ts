import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { envs } from './config/envs'; 

import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { PaymentsModule } from './payments/payments.module';
import { ReservasModule } from './reservas/reservas.module';
import { AgenciasModule } from './agencias/agencias.module';

@Module({
  imports: [
    AdminModule,
    AuthModule,
    CommonModule,
    MongooseModule.forRoot(envs.mongoUrl),
    PaymentsModule,
    ReservasModule,
    AgenciasModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
