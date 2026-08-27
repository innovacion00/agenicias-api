import { forwardRef, Module } from '@nestjs/common';
import { BitrixWebhookController } from './bitrix-webhook.controller';
import { AgenciasModule } from 'src/agencias/agencias.module';
import { AuthModule } from 'src/auth/auth.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  controllers: [BitrixWebhookController],
  imports: [
    forwardRef(() => AgenciasModule),
    forwardRef(() => AuthModule),
    CommonModule,
  ],
})
export class BitrixModule {}