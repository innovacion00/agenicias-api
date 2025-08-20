import { forwardRef, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  OtpVerification,
  OtpVerificationSchema,
  RefreshToken,
  RefreshTokenSchema,
  User,
  UserSchema,
} from './entities';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { envs } from 'src/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AgenciasModule } from 'src/agencias/agencias.module';
import { CommonModule } from 'src/common/common.module';
import { IntegrationsModule } from 'src/integrations/integrations.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  imports: [
    forwardRef(() => AgenciasModule),
    IntegrationsModule,
    CommonModule,
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      },
      {
        name: OtpVerification.name,
        schema: OtpVerificationSchema,
      },
      {
        name: RefreshToken.name,
        schema: RefreshTokenSchema,
      },
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [],
      inject: [],
      useFactory: () => {
        return {
          secret: envs.jwtSecret,
          signOptions: {
            // Access tokens con expiración corta (15 minutos)
            // Los refresh tokens tendrán expiración más larga (7 días)
            expiresIn: '15m',
          },
        };
      },
    }),
  ],
  exports: [JwtStrategy, PassportModule, JwtModule, MongooseModule],
})
export class AuthModule {}
