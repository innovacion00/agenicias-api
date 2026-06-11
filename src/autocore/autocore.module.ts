import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AutocoreClient } from './autocore.client';

@Module({
  imports: [HttpModule],
  providers: [AutocoreClient],
  exports: [AutocoreClient],
})
export class AutocoreModule {}
