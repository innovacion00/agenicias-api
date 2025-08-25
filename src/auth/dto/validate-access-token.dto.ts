import { IsString, IsNotEmpty } from 'class-validator';

export class ValidateAccessTokenDto {
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}
