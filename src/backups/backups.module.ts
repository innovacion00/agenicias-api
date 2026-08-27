import { Module } from '@nestjs/common';
import { BackupsService } from './backups.service';
import { BackupsController } from './backups.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [BackupsController],
  providers: [BackupsService],
  exports: [BackupsService],
})
export class BackupsModule {}
