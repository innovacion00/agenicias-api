import { forwardRef, Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { CommonModule } from 'src/common/common.module';
import { AutocoreModule } from 'src/autocore/autocore.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Integration, IntegrationSchema } from './entities';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
  imports: [
    forwardRef(() => AuthModule),
    CommonModule,
    AutocoreModule,
    MongooseModule.forFeature([
      {
        name: Integration.name,
        schema: IntegrationSchema,
      },
    ]),
  ],
  exports: [MongooseModule],
})
export class IntegrationsModule {}
