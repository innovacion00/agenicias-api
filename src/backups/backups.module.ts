import { Module } from '@nestjs/common';
import { BackupsService } from './backups.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  providers: [BackupsService],
  exports: [BackupsService],
})
export class BackupsModule {}
