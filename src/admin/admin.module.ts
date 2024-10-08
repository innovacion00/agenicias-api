import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuthModule } from 'src/auth/auth.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  controllers: [AdminController],
  providers: [AdminService],
  imports: [AuthModule, CommonModule],
})
export class AdminModule {}
