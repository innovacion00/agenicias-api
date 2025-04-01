import {
  Controller,
  Post,
  Body,
  Patch,
  HttpCode,
  Param,
  Get,
} from '@nestjs/common';

import { Auth, GetUser } from './decorators';

import {
  CreateUserDto,
  NewPasswordDto,
  SignInDto,
  OtpValidationDto,
  RequestPasswordChangeDto,
  RegisterUserDto,
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
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.authService.createUser(createUserDto, id);
  }

  @Post('register-user')
  @Auth(ValidRoles.admin)
  registerUserToAgency(
    @Body() registerUserDto: RegisterUserDto,
    @GetUser('agencia') id: string,
  ) {
    return this.authService.registerUserToAgency(registerUserDto, id);
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

  // #region otp code
  @Post('validate-otp')
  @HttpCode(200)
  validarOtp(@Body() otpValidation: OtpValidationDto) {
    return this.authService.validarOtpSign(otpValidation);
  }

  @Post('request-password-change')
  @HttpCode(200)
  requestPasswordChange(
    @Body() requestPasswordChange: RequestPasswordChangeDto,
  ) {
    return this.authService.requestPasswordChange(requestPasswordChange);
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
  @Auth(ValidRoles.admin, ValidRoles.superAdmin)
  switchActivationStatus(
    @GetUser('agencia') agencia: Types.ObjectId,
    @Param('userId', ParseMongoIdPipe) userId: string,
  ) {
    return this.authService.switchActivationStatus(agencia, userId);
  }

  

  // #region Administrativo
  @Get('getAllUsers')
  @Auth(ValidRoles.superAdmin)
  getAllUsers() {
    return this.authService.getAllUsers();
  }
}
