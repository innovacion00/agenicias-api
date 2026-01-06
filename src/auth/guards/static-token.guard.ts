import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { envs } from 'src/config';
import { STATIC_TOKEN_METADATA } from '../decorators/static-token-auth.decorator';

@Injectable()
export class StaticTokenGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiresStaticToken = this.reflector.get<boolean>(
      STATIC_TOKEN_METADATA,
      context.getHandler(),
    );

    if (!requiresStaticToken) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-booking-token'] || request.headers['authorization']?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('Token de autenticación requerido');
    }

    if (token !== envs.bookingPersonasToken) {
      throw new UnauthorizedException('Token de autenticación inválido');
    }

    return true;
  }
}

