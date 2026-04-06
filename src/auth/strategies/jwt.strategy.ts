import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { JwtPayload } from '../interfaces';
import { envs } from 'src/config';
import { User } from '../entities/user.entity';
import { Agencia } from 'src/agencias/entities';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Agencia.name) private readonly agenciaModel: Model<Agencia>,
  ) {
    super({
      secretOrKey: envs.jwtSecret,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }
  async validate(payload: JwtPayload): Promise<User> {
    const { _id } = payload;
    const user = await this.userModel.findById(_id);
    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Usuario inactivo, comunicarse con un administrador',
      );
    }

    const agencia = await this.agenciaModel.findById(user.agencia);

    if (!agencia) {
      throw new ForbiddenException('Agencia no encontrada');
    }

    if (!agencia.isActive) {
      throw new ForbiddenException(
        'Agencia no activa, comunicara a un administrador',
      );
    }

    return user;
  }
}
