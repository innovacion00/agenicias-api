import { Module } from '@nestjs/common';
import { MyToolService } from './my-tool.service';
import { MyToolController } from './my-tool.controller';
import { CommonModule } from 'src/common/common.module';

@Module({
  controllers: [MyToolController],
  providers: [MyToolService],
  imports:[CommonModule]
})
export class MyToolModule {}
