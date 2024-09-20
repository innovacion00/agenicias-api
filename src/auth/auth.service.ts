import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';

import { isValidObjectId, Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { isEmail } from 'class-validator';
import slugify from 'slugify';

import { User } from './entities/user.entity';
import { CreateUSerDto, SignInDto } from './dto';
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
    } else {
      this.logger.log(error);
      throw new InternalServerErrorException('Revisar logs');
    }
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

      let slug = slugify(createUserDto.fullName);
      let counter = 1;
      let slugValidation = await this.findOneByTerm(slug, 'slug');
      console.log(slugValidation);

      while (slugValidation) {
        slug = `${slugify(createUserDto.fullName, { lower: true })}-${counter}`;
        slugValidation = await this.findOneByTerm(slug, 'slug');
        counter++;
      }

      const user = await this.userModel.create({
        ...userData,
        validacion: {
          palabra: validacion.palabra.toLowerCase(),
          ...validacion,
        },
        password: bcrypt.hashSync(password, 10),
        slug,
      });
      const { password: hashedPassword, ...userObje } = user.toObject();
      return {
        ...userObje,
        token: this.generateJwt({ email: user.email }),
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
      token: this.generateJwt({ email: user.email }),
    };
  }
}
