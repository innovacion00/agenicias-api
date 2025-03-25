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
} from './dto';
import { OtpVerification } from './entities';
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

    private readonly sendEmailCustomService: SendEmailCustomService,

    private readonly jwtService: JwtService,
  ) {
    this.errorManager = new ErrorManager(AuthService.name);
  }

  private generateJwt(payload: JwtPayload) {
    const token = this.jwtService.sign(payload);
    return token;
  }

  private async findOneByTerm(term: string) {
    let user: User;
    let agencia: Agencia;

    if (!user && isValidObjectId(term)) {
      user = await this.userModel.findById(term);
    }

    if (!user && isEmail(term)) {
      user = await this.userModel.findOne({ email: term });
    }

    if (!user) {
      return null;
    }

    if (user) {
      agencia = await this.agenciaModel.findById(user.agencia);
      if (agencia && !agencia.isActive) {
        return null;
      }
    }

    if (!user.isActive) {
      return null;
    }

    return user;
  }

  private async sendValidationEmail(email: string, verificationCode: string) {
    const html = `
      <!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Código de Verificación</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      padding-bottom: 20px;
    }
    .header h1 {
      color: #333;
      margin: 0;
      font-size: 24px;
    }
    .content {
      text-align: center;
      color: #555;
      font-size: 16px;
      line-height: 1.6;
    }
    .code {
      font-size: 32px;
      font-weight: bold;
      color: #4caf50;
      letter-spacing: 8px;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      color: #999;
      font-size: 12px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Código de Verificación Geh Suites</h1>
    </div>
    <div class="content">
      <div class="code">${verificationCode}</div>
      <p>Este código es válido por 10 minutos.</p>
    </div>
    <div class="footer">
      <p>Si no solicitaste este código, puedes ignorar este mensaje.</p>
    </div>
  </div>
</body>
</html>
      `;
    await this.sendEmailCustomService.sendEmail(
      email,
      'Booking connect - Codigo de verificacion',
      '',
      html,
    );
  }
  // #region Crear Otp
  private async createOtpVerfication(userId: Types.ObjectId) {
    const otp = `${Math.floor(10000 + Math.random() * 90000)}`;
    const fechaPlus = Date.now() + 10 * 60 * 1000;
    let otpVerification: OtpVerification;

    otpVerification = await this.otpVerificationModel.findOne({ userId });

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

      agenciaDoc.usuarios.push(user._id as User);
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
    registerUserDto.fullName = registerUserDto.fullName.toLowerCase();
    try {
      const { password, adminRole, ...userData } = registerUserDto;

      const agenciaDoc = await this.agenciaModel.findById(id);

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
        role: adminRole ? ['user'] : ['admin'],
        agencia: new Types.ObjectId(id),
        password: bcrypt.hashSync(password, 10),
      });

      agenciaDoc.usuarios.push(user._id as User);
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
      .populate('agencia', 'category fullName empresa')
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
      return {
        ...user.toJSON(),
        token: this.generateJwt({ _id: user._id as string }),
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
        .populate('agencia', 'category fullName empresa')
        .exec();

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

      return {
        ...userData.toJSON(),
        token: this.generateJwt({ _id: userData._id as string }),
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

      return { valid: true, decodedToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid Token');
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
    if (!agencia.equals(user.agencia)) {
      throw new BadRequestException('Agencia Invalida');
    }

    await user.updateOne({
      ...user.toJSON(),
      isActive: !user.isActive,
    });

    return { ok: true };
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
}
