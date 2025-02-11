import { Injectable, Logger } from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { CreateIntegrationDto } from './dto';
import { ErrorManager } from 'src/common/helpers';
import { InjectModel } from '@nestjs/mongoose';
import { Integration } from './entities';
import { Model } from 'mongoose';

@Injectable()
export class IntegrationsService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(IntegrationsService.name);
  constructor(
    @InjectModel(Integration.name)
    private readonly integrationModel: Model<Integration>,
  ) {
    this.errorManager = new ErrorManager(IntegrationsService.name);
  }

  async create(createIntegrationDto: CreateIntegrationDto) {
    try {
      const { name } = createIntegrationDto;
      const apiKey = crypto.randomBytes(10).toString('base64').slice(0, 7);
      const secretKey = crypto.randomBytes(10).toString('base64');

      const integracion = await this.integrationModel.create({
        name,
        apiKey,
        secretKey: bcrypt.hashSync(secretKey, 10),
      });
      const jsonIntegracion = integracion.toJSON();
      return { ...jsonIntegracion, secretKey };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }
}
