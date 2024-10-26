import { IsNotEmpty, IsString } from 'class-validator';

export class RequestPasswordChangeDto {
  @IsString()
  @IsNotEmpty()
  email: string;
}
