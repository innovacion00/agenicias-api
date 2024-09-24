import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Patch,
  HttpCode,
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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // #region Iniciar secion/registrarse
  @Post('sign-up')
  createUser(@Body() createUserDto: CreateUSerDto) {
    return this.authService.create(createUserDto);
  }

  @Post('sign-in')
  loggin(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto);
  }
  // #endregion

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
  // #endregion

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
  // #endregion
}
