import { Module } from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { SuperAdminController } from './super-admin.controller';
import { AgenciasModule } from 'src/agencias/agencias.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  controllers: [SuperAdminController],
  providers: [SuperAdminService],
  imports: [AgenciasModule, CommonModule],
})
export class SuperAdminModule {}
