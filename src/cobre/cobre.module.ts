import { Module } from '@nestjs/common';

import { CobreClient } from './cobre.client';

@Module({
  providers: [CobreClient],
  exports: [CobreClient],
})
export class CobreModule {}
