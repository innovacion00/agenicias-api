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
  CreateUSerDto,
  NewPasswordDto,
  RefreshTokenDto,
  SignInDto,
  ValidarPalabraDto,
} from './dto';

@Injectable()
export class AuthService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,

    @InjectModel(Agencia.name) private readonly agenciaModel: Model<Agencia>,

    private readonly jwtService: JwtService,
  ) {
    this.errorManager = new ErrorManager(AuthService.name);
  }

  private generateJwt(payload: JwtPayload) {
    const token = this.jwtService.sign(payload);
    return token;
  }

  private async findOneByTerm(term: string, select: string) {
    let user: User;

    if (!user && isValidObjectId(term)) {
      user = await this.userModel.findById(term).select(select);
    }

    if (!user && isEmail(term)) {
      user = await this.userModel.findOne({ email: term }).select(select);
    }

    if (!user) {
      return null;
    }

    return user;
  }

  async create(createUserDto: CreateUSerDto, id: string) {
    createUserDto.fullName = createUserDto.fullName.toLowerCase();
    try {
      const { password, validacion, ...userData } = createUserDto;

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

      validacion.palabra = bcrypt.hashSync(validacion.palabra, 10);

      const user = await this.userModel.create({
        ...userData,
        agencia: new Types.ObjectId(id),
        // agencia: id,
        validacion,
        password: bcrypt.hashSync(password, 10),
      });

      agenciaDoc.usuarios.push(user._id as User);
      await agenciaDoc.save();

      const { password: hashedPassword, ...userDbData } = user.toObject();
      return {
        ...userDbData,
        token: this.generateJwt({ _id: userDbData._id as string }),
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  async signIn(signInDto: SignInDto) {
    const { email, password } = signInDto;
    const user = await this.userModel
      .findOne({ email })
      .lean()
      .populate('agencia', 'fullName saldo documentInfo')
      .select(
        'email password fullName telefono validacion password isActive changePassword firstLog role agencia',
      );

    const agenciaInfo = await this.agenciaModel.findById(user.agencia);
    //* Agencia
    if (!agenciaInfo) {
      throw new NotFoundException('Agencia no econtrada');
    }

    if (!agenciaInfo.isActive) {
      throw new ForbiddenException('Agencia no activa');
    }

    // *User
    if (!user) {
      throw new UnauthorizedException('Non valid credential');
    }

    if (!bcrypt.compareSync(password, user.password)) {
      throw new UnauthorizedException('Non valid credential');
    }

    const { password: hashedPassword, ...userData } = user;
    return {
      ...userData,
      token: this.generateJwt({ _id: userData._id as string }),
    };
  }

  async validarToken(token: string) {
    try {
      const decodedToken = this.jwtService.verify(token);

      return { valid: true, decodedToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid Token');
    }
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    try {
      const { _id } = refreshTokenDto;
      const user = await this.findOneByTerm(_id, '');
      if (!user.isActive) {
        throw new UnauthorizedException(
          'Usuario inactivo, comunicarse con un asesor',
        );
      }

      return {
        token: this.generateJwt({ _id }),
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  async getUserValidations(email: string) {
    try {
      const user = await this.findOneByTerm(email, 'validacion');
      if (!user) {
        throw new NotFoundException('Email not found');
      }
      return { _id: user._id, pista: user.validacion.pista };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  async validarPalabra(validarPalabraDto: ValidarPalabraDto) {
    const { id, palabra } = validarPalabraDto;
    try {
      const user = await this.userModel
        .findById(id)
        .select('validacion changePasswordTries');

      if (user.changePasswordTries === 3) {
        throw new UnauthorizedException(
          'Numero de intentos al limite, comunicarse con un asesor',
        );
      }

      if (!user) {
        throw new NotFoundException('Not found user');
      }

      const tries = user.changePasswordTries + 1;
      if (!bcrypt.compareSync(palabra, user.validacion.palabra)) {
        await user.updateOne({ ...user.toJSON(), changePasswordTries: tries });

        if (tries === 3) {
          throw new UnauthorizedException(
            'Numero de intentos al limite, comunicarse con un asesor',
          );
        }

        throw new UnauthorizedException('Credencial invalida');
      }

      await user.updateOne({ ...user.toJSON(), changePassword: true });

      return {
        valid: true,
        token: this.generateJwt({ _id: user._id as string }),
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  async changePassword(newPasswordDto: NewPasswordDto, _id: string) {
    try {
      const user = await this.findOneByTerm(
        _id,
        'password email fullName telefono validacion saldo isActive changePassword firstLog role',
      );

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
        changePassword: false,
        changePasswordTries: 0,
      });
      return { ok: true };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

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
}
