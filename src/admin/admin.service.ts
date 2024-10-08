import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from 'src/auth/entities/user.entity';
import { SwitchIsActiveDto } from './dto';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  // private handleError(error: any): never {
  //   if (error.code === 11000) {
  //     throw new BadRequestException(
  //       `${JSON.stringify(error.keyValue)} existente en BD`,
  //     );
  //   }

  //   if (error instanceof NotFoundException) {
  //     throw error;
  //   }

  //   if (error instanceof BadRequestException) {
  //     throw error;
  //   }

  //   if (error instanceof UnauthorizedException) {
  //     throw error;
  //   }

  //   this.logger.error(error);
  //   throw new InternalServerErrorException('Revisar logs');
  // }

  async switchIsActiveUser(switchIsActiveDto: SwitchIsActiveDto) {

    // const user = await this.userModel
    //   .findOne({ email: 'test@test.com' })
    //   .select('email');
    // return { msg: 'Hola mundo', user };
    this.logger.error('eso esta mal');
    throw new BadRequestException();
  }
}
