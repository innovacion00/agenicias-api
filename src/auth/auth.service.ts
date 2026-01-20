import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { isEmail } from 'class-validator';
import { isValidObjectId, Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { Agencia } from 'src/agencias/entities';
import { ErrorManager } from 'src/common/helpers';
import { JwtPayload } from './interfaces';
import { User } from './entities/user.entity';
import {
  CreateUserDto,
  RequestPasswordChangeDto,
  NewPasswordDto,
  OtpValidationDto,
  RefreshTokenDto,
  SignInDto,
  RegisterUserDto,
  ValidateAccessTokenDto,
} from './dto';
import { OtpVerification, RefreshToken } from './entities';
import { randomBytes } from 'crypto';
import { SendEmailCustomService } from 'src/common/services';

@Injectable()
export class AuthService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(AuthService.name);

  private readonly userAttributes =
    'email telefono fullName firstLog role agencia isActive changePassword otpRef imageUrl settings password';

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,

    @InjectModel(Agencia.name) private readonly agenciaModel: Model<Agencia>,

    @InjectModel(OtpVerification.name)
    private readonly otpVerificationModel: Model<OtpVerification>,

    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshToken>,

    private readonly sendEmailCustomService: SendEmailCustomService,

    private readonly jwtService: JwtService,
  ) {
    this.errorManager = new ErrorManager(AuthService.name);
  }

  private generateJwt(payload: JwtPayload) {
    const token = this.jwtService.sign(payload);
    return token;
  }

  private async generateRefreshToken(userId: Types.ObjectId): Promise<string> {
    // Generar token único usando crypto
    const refreshToken = randomBytes(64).toString('hex');
    
    // Calcular fecha de expiración (7 días)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Desactivar refresh tokens anteriores del usuario
    await this.refreshTokenModel.updateMany(
      { userId, isActive: true },
      { isActive: false }
    );

    // Crear nuevo refresh token
    await this.refreshTokenModel.create({
      userId,
      token: refreshToken,
      expiresAt,
      isActive: true,
    });

    return refreshToken;
  }

  private async generateTokenPair(userId: string) {
    const accessToken = this.generateJwt({ _id: userId });
    const refreshToken = await this.generateRefreshToken(new Types.ObjectId(userId));
    
    return {
      accessToken,
      refreshToken,
      expiresIn: '15m', // 15 minutos para el access token
    };
  }

  private async findOneByTerm(term: string) {
    let user: User | null = null;
    let agencia: Agencia | null = null;

    if (isValidObjectId(term)) {
      user = await this.userModel.findById(term);
    }

    if (!user && isEmail(term)) {
      user = await this.userModel.findOne({ email: term });
    }

    if (!user) {
      return null;
    }

    agencia = await this.agenciaModel.findById(user.agencia);
    if (agencia && !agencia.isActive) {
      return null;
    }

    if (!user.isActive) {
      return null;
    }

    return user;
  }

  private async sendValidationEmail(email: string, verificationCode: string) {
    try {
      this.logger.log(`Enviando código OTP a: ${email}`);
      this.logger.log(`Código OTP generado: ${verificationCode}`);
      
      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Código de Verificación</title>
<style>
body {
  font-family: Arial, sans-serif;
  background-color: #ffffff;
  margin: 0;
  padding: 0;
  text-align: center;
}
table {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  border-collapse: collapse;
}
td {
  text-align: center;
  padding: 0;
}
.title {
  font-size: 24px;
  font-weight: bold;
  color: #000000;
  margin: 40px 0 30px 0;
  text-align: center;
  display: block;
}
.code {
  font-size: 48px;
  font-weight: bold;
  color: #4caf50;
  margin: 30px 0;
  letter-spacing: 4px;
  text-align: center;
  display: block;
}
.message {
  font-size: 16px;
  color: #000000;
  margin: 20px 0;
  text-align: center;
  display: block;
}
.separator {
  width: 100%;
  max-width: 500px;
  height: 1px;
  background-color: #e0e0e0;
  margin: 30px auto;
  display: block;
}
.footer {
  font-size: 14px;
  color: #999999;
  margin-top: 20px;
  text-align: center;
  display: block;
}
</style>
</head>
<body>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
<tr>
<td style="text-align: center; padding: 40px 20px;">
<div class="title" style="text-align: center;">Código de Verificación Geh Suites</div>
<div class="code" style="text-align: center;">${verificationCode}</div>
<div class="message" style="text-align: center;">Este código es válido por 10 minutos.</div>
<div class="separator" style="text-align: center; margin: 30px auto;"></div>
<div class="footer" style="text-align: center;">Si no solicitaste este código, puedes ignorar este mensaje.</div>
</td>
</tr>
</table>
</body>
</html>`;
      
      await this.sendEmailCustomService.sendEmail(
        email,
        'Booking connect - Codigo de verificacion',
        html,
      );
      
      this.logger.log(`Email OTP enviado exitosamente a: ${email}`);
    } catch (error) {
      this.logger.error(`Error al enviar email OTP a ${email}:`, error);
      this.logger.error(`Stack trace: ${error.stack}`);
      // Re-lanzar el error para que el método que lo llama pueda manejarlo
      throw error;
    }
  }
  // #region Crear Otp
  private async createOtpVerfication(userId: Types.ObjectId) {
    const otp = `${Math.floor(10000 + Math.random() * 90000)}`;
    const fechaPlus = Date.now() + 10 * 60 * 1000;

    let otpVerification = await this.otpVerificationModel.findOne({ userId });

    if (!otpVerification) {
      otpVerification = await this.otpVerificationModel.create({
        userId,
        otp,
        expiresAt: fechaPlus,
      });

      return otpVerification;
    }
    otpVerification.otp = otp;
    otpVerification.expiresAt = fechaPlus;
    otpVerification.usado = false;
    await otpVerification.save();

    return otpVerification;
  }

  // #region Sign Up
  async createUser(createUserDto: CreateUserDto, id: string) {
    createUserDto.fullName = createUserDto.fullName.toLowerCase();
    try {
      const { password, ...userData } = createUserDto;

      const agenciaDoc = await this.agenciaModel.findById(id);
      if (!agenciaDoc) {
        throw new NotFoundException('Agencia invalida');
      }

      if (!agenciaDoc.isActive) {
        throw new ForbiddenException('Agencia no activa');
      }

      const usuariosActivos = await this.userModel.countDocuments({
        agencia: agenciaDoc._id,
        isActive: true,
      });
      if (usuariosActivos >= agenciaDoc.userLimit) {
        throw new BadRequestException(
          'No se pueden crear más usuarios en esta agencia.',
        );
      }

      const user = await this.userModel.create({
        ...userData,
        role: agenciaDoc.usuarios.length >= 1 ? ['user'] : ['admin'],
        agencia: new Types.ObjectId(id),
        password: bcrypt.hashSync(password, 10),
      });


      agenciaDoc.usuarios.push(user._id as Types.ObjectId);
      await agenciaDoc.save();

      const { password: hashedPassword, ...userDbData } = user.toObject();

      const verification = await this.createOtpVerfication(
        userDbData._id as Types.ObjectId,
      );

      user.otpRef = verification._id as Types.ObjectId;
      await user.save();
      if (createUserDto.omitirOtp) {
        return {
          status: 'Ok',
          msg: 'Usuario creado con exito',
        };
      }

      await this.sendValidationEmail(user.email, verification.otp);

      return {
        status: 'Pending',
        msg: 'Validar Otp code correo',
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Registrar usuario
  async registerUserToAgency(registerUserDto: RegisterUserDto, id: string) {
    registerUserDto.fullName = registerUserDto.fullName.toLowerCase().trim();
    try {
      const { password, adminRole, ...userData } = registerUserDto;

      const agenciaDoc = await this.agenciaModel.findById(id);

      if (!agenciaDoc) {
        throw new NotFoundException('Agencia no encontrada');
      }

      const usuariosActivos = await this.userModel.countDocuments({
        agencia: agenciaDoc._id,
        isActive: true,
      });

      if (usuariosActivos >= agenciaDoc.userLimit) {
        throw new BadRequestException(
          'No se pueden crear más usuarios en esta agencia.',
        );
      }
      
      const user = await this.userModel.create({
        ...userData,
        role: adminRole ? ['admin'] : ['user'],
        agencia: new Types.ObjectId(id),
        password: bcrypt.hashSync(password, 10),
      });


      agenciaDoc.usuarios.push(user._id as Types.ObjectId);
      await agenciaDoc.save();

      const { password: hashedPassword, ...userDbData } = user.toObject();

      const verification = await this.createOtpVerfication(
        userDbData._id as Types.ObjectId,
      );

      user.otpRef = verification._id as Types.ObjectId;
      await user.save();

      return {
        status: 'Ok',
        msg: 'Usuario creado con exito',
        cuposAgencia: agenciaDoc.userLimit - agenciaDoc.usuarios.length,
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Sign in
  async signIn(signInDto: SignInDto) {
    const { email, password } = signInDto;
    const user = await this.userModel
      .findOne({ email })
      .populate('agencia', 'category fullName empresa slug')
      .select(this.userAttributes)
      .exec();

    // *User
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Non valid credential');
    }
    const agenciaInfo = await this.agenciaModel.findById(user.agencia);
    //* Agencia
    if (!agenciaInfo) {
      throw new NotFoundException('Agencia no econtrada');
    }

    if (!agenciaInfo.isActive) {
      throw new ForbiddenException('Agencia no activa');
    }

    if (!bcrypt.compareSync(password, user.password)) {
      throw new UnauthorizedException('Non valid credential');
    }

    if (user.settings.omitirOtp) {
      const { password, ...userWithoutPassword } = user.toJSON();
      const tokens = await this.generateTokenPair((user._id as Types.ObjectId).toString());
      return {
        ...userWithoutPassword,
        ...tokens,
      };
    }

    const verification = await this.createOtpVerfication(
      user._id as Types.ObjectId,
    );

    await this.sendValidationEmail(user.email, verification.otp);

    return {
      status: 'Pending',
      msg: 'Validar Otp code correo',
    };
  }

  // #region validar OTP
  async validarOtpSign({ otp, email }: OtpValidationDto) {
    const fechaNow = Date.now();
    try {
      const userData = await this.userModel
        .findOne({ email })
        .select(this.userAttributes)
        .populate('agencia', 'category fullName empresa slug')
        .exec();

      if (!userData) {
        throw new NotFoundException('Usuario no encontrado');
      }

      const validacionDb = await this.otpVerificationModel.findById(
        userData.otpRef,
      );

      if (!validacionDb) {
        throw new NotFoundException('No se encontro codigo de verificacion');
      }

      if (validacionDb.expiresAt < fechaNow) {
        throw new BadRequestException('Codigo vencido');
      }

      if (validacionDb.usado) {
        throw new UnauthorizedException('Codigo invalido');
      }

      if (validacionDb.otp !== otp) {
        throw new BadRequestException('Codigo invalido');
      }

      validacionDb.usado = true;

      await validacionDb.save();

      const { password, ...userWithoutPassword } = userData.toJSON();
      const tokens = await this.generateTokenPair((userData._id as Types.ObjectId).toString());
      return {
        ...userWithoutPassword,
        ...tokens,
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Validar token
  async validarToken(token: string) {
    try {
      const decodedToken = this.jwtService.verify(token);

      // Obtener información del usuario y su agencia
      const user = await this.userModel
        .findById(decodedToken._id)
        .select('_id fullName email telefono role isActive agencia imageUrl settings')
        .populate('agencia', 'fullName category empresa isActive slug emailContacto telefonoContacto documentInfo autocoreInfo cobreInfo')
        .exec();

      if (!user) {
        throw new UnauthorizedException('Usuario no encontrado');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Usuario inactivo');
      }

      // Verificar que la agencia esté activa
      if (user.agencia && typeof user.agencia === 'object' && 'isActive' in user.agencia && !user.agencia.isActive) {
        throw new ForbiddenException('Agencia inactiva');
      }

      // Calcular tiempo restante del token
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = decodedToken.exp;
      const timeRemaining = expiresAt - now;
      const minutesRemaining = Math.floor(timeRemaining / 60);

      // Preparar respuesta sin password
      const { password, ...userWithoutPassword } = user.toJSON();

      return {
        valid: true,
        decodedToken,
        user: userWithoutPassword,
        agencia: user.agencia,
        token: {
          expiresAt: new Date(expiresAt * 1000).toISOString(),
          timeRemaining: `${minutesRemaining} minutos`,
          secondsRemaining: timeRemaining,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid Token');
    }
  }

  // #region Validar Access Token
  async validateAccessToken(validateAccessTokenDto: ValidateAccessTokenDto) {
    try {
      const { accessToken } = validateAccessTokenDto;
      
      // Verificar el token JWT
      const decodedToken = this.jwtService.verify(accessToken);
      
      // Verificar que el usuario existe y está activo
      const user = await this.userModel
        .findById(decodedToken._id)
        .select('_id fullName email role isActive agencia')
        .populate('agencia', 'fullName category empresa isActive slug')
        .exec();

      if (!user) {
        return {
          valid: false,
          message: 'Usuario no encontrado',
          code: 'USER_NOT_FOUND'
        };
      }

      if (!user.isActive) {
        return {
          valid: false,
          message: 'Usuario inactivo',
          code: 'USER_INACTIVE'
        };
      }

      // Verificar que la agencia esté activa
      if (user.agencia && typeof user.agencia === 'object' && 'isActive' in user.agencia && !user.agencia.isActive) {
        return {
          valid: false,
          message: 'Agencia inactiva',
          code: 'AGENCY_INACTIVE'
        };
      }

      // Calcular tiempo restante del token
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = decodedToken.exp;
      const timeRemaining = expiresAt - now;
      const minutesRemaining = Math.floor(timeRemaining / 60);

      return {
        valid: true,
        message: 'Token válido',
        code: 'TOKEN_VALID',
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          agencia: user.agencia
        },
        token: {
          expiresAt: new Date(expiresAt * 1000).toISOString(),
          timeRemaining: `${minutesRemaining} minutos`,
          secondsRemaining: timeRemaining
        }
      };

    } catch (error) {
      this.logger.error('Error validando access token:', error);
      
      if (error.name === 'TokenExpiredError') {
        return {
          valid: false,
          message: 'Token expirado',
          code: 'TOKEN_EXPIRED'
        };
      }
      
      if (error.name === 'JsonWebTokenError') {
        return {
          valid: false,
          message: 'Token inválido',
          code: 'TOKEN_INVALID'
        };
      }

      return {
        valid: false,
        message: 'Error validando token',
        code: 'VALIDATION_ERROR',
        error: error.message
      };
    }
  }

  // #region Refresh Token
  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    try {
      const { token } = refreshTokenDto;

      // Buscar el refresh token en la base de datos
      const refreshTokenDoc = await this.refreshTokenModel.findOne({
        token,
        isActive: true,
      });

      if (!refreshTokenDoc) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Verificar si el token ha expirado
      if (refreshTokenDoc.expiresAt < new Date()) {
        // Desactivar el token expirado
        refreshTokenDoc.isActive = false;
        await refreshTokenDoc.save();
        throw new UnauthorizedException('Refresh token expired');
      }

      // Buscar el usuario asociado
      const user = await this.userModel
        .findById(refreshTokenDoc.userId)
        .select(this.userAttributes)
        .populate('agencia', 'category fullName empresa')
        .exec();

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Verificar que la agencia esté activa
      const agencia = await this.agenciaModel.findById(user.agencia);
      if (!agencia || !agencia.isActive) {
        throw new ForbiddenException('Agency not active');
      }

      // Desactivar el refresh token usado (rotación de tokens)
      refreshTokenDoc.isActive = false;
      await refreshTokenDoc.save();

      // Generar nuevos tokens
      const tokens = await this.generateTokenPair((user._id as Types.ObjectId).toString());

      // Devolver usuario con nuevos tokens
      const { password, ...userWithoutPassword } = user.toJSON();
      return {
        ...userWithoutPassword,
        ...tokens,
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Solicitar Cambio de contraseña
  async requestPasswordChange(
    requestPasswordChangeDto: RequestPasswordChangeDto,
  ) {
    const user = await this.findOneByTerm(requestPasswordChangeDto.email);

    if (!user) {
      throw new BadRequestException('Usuario no encontrado o inactivo');
    }
    const verification = await this.createOtpVerfication(
      user._id as Types.ObjectId,
    );

    // user.changePassword = true;
    await user.save();

    await this.sendValidationEmail(user.email, verification.otp);

    return {
      status: 'Pending',
      msg: 'Validar Otp code correo',
    };
  }

  // #region Cambiar contraseña
  async changePassword(newPasswordDto: NewPasswordDto, _id: string) {
    try {
      const user = await this.userModel.findById(_id).select('password');
      if (!user) {
        throw new NotFoundException('Non found user');
      }

      if (bcrypt.compareSync(newPasswordDto.password, user.password)) {
        throw new BadRequestException('No se permite la misma contraseña');
      }
      const hashPassword = bcrypt.hashSync(newPasswordDto.password, 10);

      await user.updateOne({
        ...user.toJSON(),
        password: hashPassword,
      });
      return { ok: true };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Cambiar estado de actividad en un usuario
  async switchActivationStatus(agencia: Types.ObjectId, userId: string) {
    const user = await this.userModel.findById(userId);
    
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!agencia.equals(user.agencia)) {
      throw new BadRequestException('Agencia Invalida');
    }

    await user.updateOne({
      ...user.toJSON(),
      isActive: !user.isActive,
    });

    return { ok: true };
  }

  // #region Limpiar refresh tokens expirados
  async cleanupExpiredRefreshTokens() {
    try {
      const result = await this.refreshTokenModel.deleteMany({
        $or: [
          { expiresAt: { $lt: new Date() } },
          { isActive: false }
        ]
      });
      
      this.logger.log(`Cleaned up ${result.deletedCount} expired refresh tokens`);
      return { deletedCount: result.deletedCount };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Revocar todos los refresh tokens de un usuario
  async revokeUserRefreshTokens(userId: string) {
    try {
      const result = await this.refreshTokenModel.updateMany(
        { userId: new Types.ObjectId(userId), isActive: true },
        { isActive: false }
      );
      
      this.logger.log(`Revoked ${result.modifiedCount} refresh tokens for user ${userId}`);
      return { revokedCount: result.modifiedCount };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Administrativo
  async getAllUsers() {
    try {
      const users = await this.userModel.find();
      return users;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Actualizar políticas de agencia
  async updatePoliticasAgencia(
    userId: string,
    politicasAgencia: string,
  ) {
    try {
      const user = await this.userModel.findById(userId);

      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }

      // Actualizar las políticas en la agencia, no en el usuario
      const agencia = await this.agenciaModel.findById(user.agencia);

      if (!agencia) {
        throw new NotFoundException('Agencia no encontrada');
      }

      agencia.politicasAgencia = politicasAgencia;
      await agencia.save();

      return {
        message: 'Políticas de agencia actualizadas correctamente',
        politicasAgencia: agencia.politicasAgencia,
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }
}
