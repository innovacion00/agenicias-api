import { OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class RegisterUserDto extends OmitType(CreateUserDto, [
  'omitirOtp',
] as const) {
  @IsBoolean()
  @IsOptional()
  adminRole?: boolean;
}
