import { Controller, Get, Param, Patch } from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { ParseMongoIdPipe } from 'src/common/pipes';
import { Types } from 'mongoose';

@Controller('super-admin')
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  // TODO: Auth con el superadmin
  @Patch('switch-activation-agencia/:agenciaId')
  switchActivationAgency(
    @Param('agenciaId', ParseMongoIdPipe) agenciaId: Types.ObjectId,
  ) {
    return this.superAdminService.switchAgenciaStatus(agenciaId);
  }
}
