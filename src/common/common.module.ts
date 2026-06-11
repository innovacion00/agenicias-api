import { Module } from '@nestjs/common';
import { HttpCustomService } from './services/http-custom.service';
import { HttpModule } from '@nestjs/axios';
import { SendEmailCustomService } from './services';
import { AutocoreModule } from 'src/autocore/autocore.module';
import { CobreModule } from 'src/cobre/cobre.module';

@Module({
  imports: [HttpModule, AutocoreModule, CobreModule],
  providers: [HttpCustomService, SendEmailCustomService],
  exports: [HttpCustomService, SendEmailCustomService],
})
export class CommonModule {}
