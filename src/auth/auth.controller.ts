import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  SetMetadata,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { CreateUSerDto, SignInDto } from './dto';
import { GetUser } from './decorators';
import { User } from './entities/user.entity';
import { RawHeaders } from 'src/common/decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-up')
  createUser(@Body() createUserDto: CreateUSerDto) {
    return this.authService.create(createUserDto);
  }

  @Post('sign-in')
  loggin(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto);
  }

  @Get('private')
  @SetMetadata('roles', ['admin'])
  @UseGuards(AuthGuard())
  private(@GetUser() user: User) {
    return {
      mag: 'priva',
      user,
    };
  }
}
