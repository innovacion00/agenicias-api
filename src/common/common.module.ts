import { Module } from '@nestjs/common';
import { HttpCustomService } from './services/http-custom.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [HttpCustomService],
  exports: [HttpCustomService],
})
export class CommonModule {}
