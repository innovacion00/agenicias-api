import { forwardRef, Module } from '@nestjs/common';
import { BitrixWebhookController } from './bitrix-webhook.controller';
import { BitrixWebhookService } from './bitrix-webhook.service';
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
  providers: [BitrixWebhookService],
})
export class BitrixModule {}