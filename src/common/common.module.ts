import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SendEmailCustomService } from './services';

@Module({
  imports: [HttpModule],
  providers: [SendEmailCustomService],
  exports: [SendEmailCustomService],
})
export class CommonModule {}
