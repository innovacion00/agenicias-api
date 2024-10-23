import { Module } from '@nestjs/common';
import { HttpCustomService } from './services/http-custom.service';
import { HttpModule } from '@nestjs/axios';
import { SendEmailCustomService } from './services';

@Module({
  imports: [HttpModule],
  providers: [HttpCustomService, SendEmailCustomService],
  exports: [HttpCustomService, SendEmailCustomService],
})
export class CommonModule {}
