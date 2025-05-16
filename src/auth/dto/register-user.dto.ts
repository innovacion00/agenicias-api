import { OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsArray, IsEnum, IsString } from 'class-validator';
import { ValidRoles } from '../interfaces';

export class RegisterUserDto extends OmitType(CreateUserDto, [
  'omitirOtp',
] as const) {
  @IsArray()
  @IsEnum(ValidRoles, { each: true })
  roles: ValidRoles[];
}
