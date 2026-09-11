import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigService } from './app-config.service';
import { AppConfigController } from './app-config.controller';
import { AppConfig, AppConfigSchema } from './entities';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [AppConfigController],
  providers: [AppConfigService],
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      {
        name: AppConfig.name,
        schema: AppConfigSchema,
      },
    ]),
  ],
})
export class AppConfigModule {}