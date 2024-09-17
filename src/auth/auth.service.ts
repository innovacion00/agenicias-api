import { Injectable } from '@nestjs/common';
import { CreateUSerDto } from './dto/create-user.dto';

@Injectable()
export class AuthService {
  create(createUserDto: CreateUSerDto) {
    return 'This action adds a new auth';
  }
}
