import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Patch,
  HttpCode,
  Param,
  Delete,
} from '@nestjs/common';

import { Auth, GetUser } from './decorators';

import {
  CreateUSerDto,
  NewPasswordDto,
  SignInDto,
  ValidarPalabraDto,
  RefreshTokenDto,
} from './dto';

import { AuthService } from './auth.service';
import { ValidRoles } from './interfaces';
import { ParseMongoIdPipe } from 'src/common/pipes';
import { Types } from 'mongoose';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // #region Iniciar secion/registrarse
  @Post('sign-up/:id')
  createUser(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() createUserDto: CreateUSerDto,
  ) {
    return this.authService.create(createUserDto, id);
  }

  @Post('sign-in')
  loggin(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto);
  }

  // #region Tokens
  @Post('validar-token')
  @HttpCode(200)
  validarToken(@Body() token: string) {
    return this.authService.validarToken(token);
  }

  @Post('refresh-token')
  @Auth(ValidRoles.admin)
  refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    this.authService.refreshToken(refreshTokenDto);
  }

  // #region Cambio contraseña
  @Get('get-validation')
  getValidation(@Query('email') email: string) {
    return this.authService.getUserValidations(email);
  }

  @Post('validar-palabra')
  @HttpCode(200)
  validarPalabra(@Body() validarPalabraDto: ValidarPalabraDto) {
    return this.authService.validarPalabra(validarPalabraDto);
  }

  @Patch('new-credentials')
  @Auth()
  changePassword(
    @GetUser('_id') _id: string,
    @Body() newPasswordDto: NewPasswordDto,
  ) {
    return this.authService.changePassword(newPasswordDto, _id);
  }
  // #region Usuarios
  @Patch('switch-activation-status/:userId')
  @Auth(ValidRoles.admin)
  switchActivationStatus(
    @GetUser('agencia') agencia: Types.ObjectId,
    @Param('userId', ParseMongoIdPipe) userId: string,
  ) {
    return this.authService.switchActivationStatus(agencia, userId);
  }
}
