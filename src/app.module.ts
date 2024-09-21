import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { envs } from './config/envs';
import { CommonModule } from './common/common.module';

@Module({
  imports: [MongooseModule.forRoot(envs.mongoUrl), AuthModule, CommonModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
