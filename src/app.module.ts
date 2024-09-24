import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { envs } from './config/envs';
import { CommonModule } from './common/common.module';
import { ReservasModule } from './reservas/reservas.module';

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
