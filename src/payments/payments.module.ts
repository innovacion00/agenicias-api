import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { AuthModule } from 'src/auth/auth.module';
import { CommonModule } from 'src/common/common.module';
import { HttpCustomService } from 'src/common/services';
import { AgenciasModule } from 'src/agencias/agencias.module';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, HttpCustomService],
  imports: [AuthModule, CommonModule, AgenciasModule],
})
export class PaymentsModule {}
