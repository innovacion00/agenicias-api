import { IsNotEmpty, IsString } from 'class-validator';

export class UpdatePoliticasDto {
  @IsString()
  @IsNotEmpty()
  politicasAgencia: string;
}

