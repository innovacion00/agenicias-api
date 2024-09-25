import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';

import { isValidObjectId, Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { isEmail } from 'class-validator';
import slugify from 'slugify';

import { User } from './entities/user.entity';
import {
  CreateUSerDto,
  NewPasswordDto,
  RefreshTokenDto,
  SignInDto,
  ValidarPalabraDto,
} from './dto';
import { JwtPayload } from './interfaces';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,

    private readonly jwtService: JwtService,
  ) {}

  private handleError(error: any): never {
    if (error.code === 11000) {
      throw new BadRequestException(
        `${JSON.stringify(error.keyValue)} existente en BD`,
      );
    }

    if (error instanceof NotFoundException) {
      throw error;
    }

    if (error instanceof BadRequestException) {
      throw error;
    }

    if (error instanceof UnauthorizedException) {
      throw error;
    }

    this.logger.log(error);
    throw new InternalServerErrorException('Revisar logs');
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
      user = await this.userModel.findOne({ slug: term }).select(select);
    }

    if (!user) {
      return null;
    }

    return user;
  }

  async create(createUserDto: CreateUSerDto) {
    createUserDto.fullName = createUserDto.fullName.toLowerCase();
    try {
      const { password, validacion, ...userData } = createUserDto;

      validacion.palabra = bcrypt.hashSync(validacion.palabra, 10);

      let slug = slugify(createUserDto.fullName);
      let counter = 1;
      let slugValidation = await this.findOneByTerm(slug, 'slug');

      while (slugValidation) {
        slug = `${slugify(createUserDto.fullName, { lower: true })}-${counter}`;
        slugValidation = await this.findOneByTerm(slug, 'slug');
        counter++;
      }

      const user = await this.userModel.create({
        ...userData,
        validacion,
        password: bcrypt.hashSync(password, 10),
        slug,
      });
      const { password: hashedPassword, ...userDbData } = user.toObject();
      return {
        ...userDbData,
        token: this.generateJwt({ _id: userDbData._id as string }),
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  async signIn(signInDto: SignInDto) {
    const { email, password } = signInDto;
    // const user = await this.findOneByTerm(email, 'email password');
    const user = await this.userModel
      .findOne({ email })
      .lean()
      .select(
        'email password fullName telefono validacion slug password isActive changePassword firstLog role',
      );

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
      this.handleError(error);
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
      this.handleError(error);
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
      this.handleError(error);
    }
  }

  async changePassword(newPasswordDto: NewPasswordDto, _id: string) {
    try {
      const user = await this.findOneByTerm(
        _id,
        'password email fullName telefono validacion slug saldo isActive changePassword firstLog role',
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
      this.handleError(error);
    }
  }
}
