import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { CreateUSerDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { isEmail } from 'class-validator';
import slugify from 'slugify';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
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

  private async findOneByTerm(term: string) {
    let user: User;

    if (!user && isValidObjectId(term)) {
      user = await this.userModel.findById(term);
    }

    if (!user && isEmail(term)) {
      user = await this.userModel.findOne({ email: term });
    }

    if (!user) {
      user = await this.userModel.findOne({ slug: term });
    }

    if (!user) {
      return null;
    }

    return user;
  }

  async create(createUserDto: CreateUSerDto) {
    createUserDto.fullName = createUserDto.fullName.toLowerCase();
    try {
      const { password, ...userData } = createUserDto;
      let slug = slugify(createUserDto.fullName);
      let counter = 1;
      let slugValidation = await this.findOneByTerm(slug);

      while (slugValidation) {
        slug = `${slugify(createUserDto.fullName, { lower: true })}-${counter}`;
        slugValidation = await this.findOneByTerm(slug);
        counter++;
      }

      const user = await this.userModel.create({
        ...userData,
        slug,
        password: bcrypt.hashSync(password, 10),
      });
      return user;
    } catch (error) {
      this.handleError(error);
    }
  }
}
