import { Module } from '@nestjs/common';

import { AuthModule } from 'src/auth/auth.module';
import { ReservasController } from './reservas.controller';

import { ReservasService } from './reservas.service';

@Module({
  controllers: [ReservasController],
  providers: [ReservasService],
  imports: [AuthModule],
})
export class ReservasModule {}
