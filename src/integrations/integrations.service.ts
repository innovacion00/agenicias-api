import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { CreateIntegrationDto } from './dto';
import { ChatBridgeDto } from './dto/chat-bridge.dto';
import { ErrorManager } from 'src/common/helpers';
import { InjectModel } from '@nestjs/mongoose';
import { Integration } from './entities';
import { Model } from 'mongoose';
import { HttpCustomService } from 'src/common/services';
import { DisponibilidadAutocoreDto } from 'src/reservas/dto';
import { ValidIntegrationsRoles } from 'src/auth/interfaces';
import { envs } from 'src/config';

@Injectable()
export class IntegrationsService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(IntegrationsService.name);
  constructor(
    @InjectModel(Integration.name)
    private readonly integrationModel: Model<Integration>,

    private readonly httpCustomService: HttpCustomService,
  ) {
    this.errorManager = new ErrorManager(IntegrationsService.name);
  }

  async create(createIntegrationDto: CreateIntegrationDto) {
    try {
      const { name, roles } = createIntegrationDto;
      const apiKey = crypto.randomBytes(10).toString('base64').slice(0, 7);
      const secretKey = crypto.randomBytes(10).toString('base64');

      const integracion = await this.integrationModel.create({
        name,
        roles: roles ?? [],
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

  async getDisponibilidad(
    disponibilidadAutoCoreDto: DisponibilidadAutocoreDto,
    roles: string[],
  ) {
    try {
      const { layout, checkingDate, ciudad, nights } =
        disponibilidadAutoCoreDto;

      const dev = roles.includes(ValidIntegrationsRoles.autodoreDev);

      if (
        disponibilidadAutoCoreDto.category === 0 ||
        disponibilidadAutoCoreDto.category === 1
      ) {
        const data = await this.httpCustomService.getDisponibilidadAutocore(
          layout,
          checkingDate,
          nights,
          ciudad,
          disponibilidadAutoCoreDto.category,
          dev,
        );

        return data;
      } else {
        const data = await this.httpCustomService.getDisponibilidadAutocore(
          layout,
          checkingDate,
          nights,
          ciudad,
          0,
          dev,
        );

        return data;
      }
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  async chat(chatBridgeDto: ChatBridgeDto, b2bToken: string) {
    try {
      const hostBridge = envs.hostBridge?.trim();
      const baseHost = hostBridge?.replace(/^https?:\/\//, '');
      const bridgeUrl = `http://${baseHost}:3001/chat`;

      const payload = {
        ...chatBridgeDto,
        b2bToken,
      };

      const { data } = await axios.post(bridgeUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return data;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }
}
