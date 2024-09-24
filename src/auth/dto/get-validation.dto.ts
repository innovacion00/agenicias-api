import { IsNotEmpty, IsString } from 'class-validator';

export class GetValidationDto {
  @IsString()
  @IsNotEmpty()
  email: string;
}
