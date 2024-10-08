import { Body, Controller, Patch } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Auth, GetUser } from 'src/auth/decorators';
import { ValidRoles } from 'src/auth/interfaces';
import { User } from 'src/auth/entities/user.entity';
import { SwitchIsActiveDto } from './dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // @Auth(ValidRoles.superUser)
  @Patch('switch-active')
  switchIsActive(@Body() switchIsActiveDto: SwitchIsActiveDto) {
    return this.adminService.switchIsActiveUser(switchIsActiveDto);
  }
}
