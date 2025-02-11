import { forwardRef, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  OtpVerification,
  OtpVerificationSchema,
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
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [],
      inject: [],
      useFactory: () => {
        return {
          secret: envs.jwtSecret,
          signOptions: {
            /*
            TODO: Ahora es tu problema crear una forma de refrescar 
            el token, el del frontend no sabia como hacer cosas 
            basicas(No sabia hacer nada) y me dio flojera crear 
            una ruta de refrescar token y explicarle como usarla,
            buena suerte ✌️*/
            expiresIn: '365d',
          },
        };
      },
    }),
  ],
  exports: [JwtStrategy, PassportModule, JwtModule, MongooseModule],
})
export class AuthModule {}
