import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { envs } from './config/envs'; 

import { AgenciasModule } from './agencias/agencias.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { PaymentsModule } from './payments/payments.module';
import { ReservasModule } from './reservas/reservas.module';
import { SuperAdminModule } from './super-admin/super-admin.module';

@Module({
  imports: [
    AuthModule,
    CommonModule,
    MongooseModule.forRoot(envs.mongoUrl),
    PaymentsModule,
    ReservasModule,
    AgenciasModule,
    SuperAdminModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
