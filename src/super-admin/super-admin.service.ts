import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model, Types } from 'mongoose';

import { Agencia } from 'src/agencias/entities';
import { ErrorManager } from 'src/common/helpers';

@Injectable()
export class SuperAdminService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(SuperAdminService.name);
  constructor(
    @InjectModel(Agencia.name) private readonly agenciaModel: Model<Agencia>,
  ) {
    this.errorManager = new ErrorManager(SuperAdminService.name);
  }

  async switchAgenciaStatus(agenciaId: Types.ObjectId) {
    try {
      throw new UnauthorizedException('Nada');
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }
}
