import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { JwtPayload } from '../interfaces';
import { envs } from 'src/config/envs';
import { User } from '../entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {
    super({
      secretOrKey: envs.jwtSecret,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }
  async validate(payload: JwtPayload): Promise<User> {
    const { _id } = payload;
    const user = await this.userModel.findById({ _id });
    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Usuario inactivo, comunicarse con un administrador',
      );
    }

    return user;
  }
}
