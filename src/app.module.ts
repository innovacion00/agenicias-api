import { Module } from '@nestjs/common';

import { MongooseModule } from '@nestjs/mongoose';

import { AuthModule } from './auth/auth.module';
import { ReservasModule } from './reservas/reservas.module';
import { CommonModule } from './common/common.module';

import { envs } from './config/envs';

@Module({
  imports: [
    MongooseModule.forRoot(envs.mongoUrl),
    AuthModule,
    CommonModule,
    ReservasModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
