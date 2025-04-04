import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Integration } from 'src/integrations/entities';
import { API_KEY_METADATA, META_INTEGRATIONS_ROLES } from '../decorators';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectModel('Integration')
    private readonly integrationModel: Model<Integration>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresApiKey = this.reflector.get<boolean>(
      API_KEY_METADATA,
      context.getHandler(),
    );

    const validRoles = this.reflector.get(
      META_INTEGRATIONS_ROLES,
      context.getHandler(),
    );
    if (!requiresApiKey) return true;

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['api-key'];
    const secretKey = request.headers['secret-key'];

    if (!apiKey || !secretKey) {
      throw new UnauthorizedException('API Key y Secret Key son requeridos');
    }

    const integration = await this.integrationModel.findOne({ apiKey });

    if (!integration || !integration.isActive) {
      throw new UnauthorizedException('Integración inválida o desactivada');
    }

    const isSecretValid = await bcrypt.compare(
      secretKey,
      integration.secretKey,
    );
    if (!isSecretValid) {
      throw new UnauthorizedException('Secret Key inválida');
    }

    if (!validRoles) return true;
    if (validRoles.length === 0) return true;

    for (const role of integration.roles) {
      if (validRoles.includes(role)) {
        return true;
      }
    }

    throw new ForbiddenException(
      `Integration ${integration.name} invalid permissions`,
    );
  }
}
