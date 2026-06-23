import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import {
  DistributedLockService,
  RedisCacheService,
  SendEmailCustomService,
} from './services';

@Module({
  imports: [HttpModule],
  providers: [
    SendEmailCustomService,
    DistributedLockService,
    RedisCacheService,
  ],
  exports: [SendEmailCustomService, DistributedLockService, RedisCacheService],
})
export class CommonModule {}
