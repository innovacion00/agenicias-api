import {
  Controller,
  Post,
  Body,
  Patch,
  HttpCode,
  Param,
  Get,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Auth, GetUser } from './decorators';

import {
  CreateUserDto,
  NewPasswordDto,
  SignInDto,
  OtpValidationDto,
  RefreshTokenDto,
  RequestPasswordChangeDto,
  RegisterUserDto,
  UpdatePoliticasDto,
  ValidarTokenDto,
  ValidateAccessTokenDto,
} from './dto';

import { AuthService } from './auth.service';
import { ValidRoles } from './interfaces';
import { ParseMongoIdPipe } from 'src/common/pipes';
import { Types } from 'mongoose';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // #region Iniciar secion/registrarse
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 registros por minuto
  @ApiOperation({ summary: 'Crear usuario asociado a una agencia' })
  @ApiParam({ name: 'id', description: 'ID de la agencia (MongoId)' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @Post('sign-up/:id')
  createUser(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.authService.createUser(createUserDto, id);
  }

  @ApiOperation({
    summary: 'Registrar usuario a una agencia (solo admin o superAdmin)',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 201, description: 'Usuario registrado exitosamente' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  @Post('register-user')
  @Auth(ValidRoles.admin, ValidRoles.superAdmin)
  registerUserToAgency(
    @Body() registerUserDto: RegisterUserDto,
    @GetUser('agencia') id: string,
  ) {
    return this.authService.registerUserToAgency(registerUserDto, id);
  }

  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso, retorna tokens JWT',
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 intentos por minuto para login
  @Post('sign-in')
  loggin(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto);
  }

  // #region Tokens
  @ApiOperation({
    summary: 'Validar token JWT y obtener información del usuario y agencia',
  })
  @ApiResponse({
    status: 200,
    description: 'Token válido con información del usuario y agencia',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', example: true },
        decodedToken: { type: 'object' },
        user: { type: 'object' },
        agencia: { type: 'object' },
        token: {
          type: 'object',
          properties: {
            expiresAt: { type: 'string', example: '2025-12-01T10:30:00.000Z' },
            timeRemaining: { type: 'string', example: '14 minutos' },
            secondsRemaining: { type: 'number', example: 840 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Token inválido o usuario no encontrado',
  })
  @ApiResponse({ status: 403, description: 'Usuario o agencia inactiva' })
  @Post('validar-token')
  @HttpCode(200)
  validarToken(@Body() validarTokenDto: ValidarTokenDto) {
    return this.authService.validarToken(validarTokenDto.token);
  }

  @ApiOperation({
    summary: 'Validar access token y obtener información del usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Token válido con información del usuario',
  })
  @ApiResponse({ status: 401, description: 'Token inválido' })
  @Post('validate-access-token')
  @HttpCode(200)
  validateAccessToken(@Body() validateAccessTokenDto: ValidateAccessTokenDto) {
    return this.authService.validateAccessToken(validateAccessTokenDto);
  }

  @ApiOperation({ summary: 'Renovar token JWT usando refresh token' })
  @ApiResponse({ status: 200, description: 'Nuevo token generado' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido' })
  @Throttle({ short: { limit: 10, ttl: 60000 } }) // 10 requests por minuto
  @Post('refresh-token')
  @HttpCode(200)
  refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  // #region otp code
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 intentos por minuto para OTP
  @Post('validate-otp')
  @HttpCode(200)
  validarOtp(@Body() otpValidation: OtpValidationDto) {
    return this.authService.validarOtpSign(otpValidation);
  }

  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 requests por minuto para cambio de contraseña
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

  // #region Actualizar políticas de agencia
  @ApiOperation({ summary: 'Actualizar políticas de la agencia' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({
    status: 200,
    description: 'Políticas actualizadas correctamente',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @Patch('politicas-agencia')
  @Auth()
  updatePoliticasAgencia(
    @GetUser('_id') userId: string,
    @Body() updatePoliticasDto: UpdatePoliticasDto,
  ) {
    return this.authService.updatePoliticasAgencia(
      userId,
      updatePoliticasDto.politicasAgencia,
    );
  }

  @ApiOperation({
    summary: 'Marcar encuesta como completada',
    description: 'Actualiza el campo encuesta del usuario autenticado a true.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({
    status: 200,
    description: 'Encuesta actualizada correctamente',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @Patch('encuesta')
  @Auth()
  actualizarEncuesta(@GetUser('_id') userId: string) {
    return this.authService.actualizarEncuesta(userId);
  }
}
