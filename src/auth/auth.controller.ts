import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  SetMetadata,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { CreateUSerDto, SignInDto } from './dto';
import { Auth, GetUser, RoleProtected } from './decorators';
import { User } from './entities/user.entity';
import { UserRoleGuard } from './guards/user-role.guard';
import { ValidRoles } from './interfaces';

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
  @Auth(ValidRoles.admin)
  private(@GetUser() user: User) {
    return {
      mag: 'priva',
      user,
    };
  }
}
