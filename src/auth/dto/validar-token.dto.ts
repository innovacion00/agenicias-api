import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ValidarTokenDto {
  @ApiProperty({
    description: 'Token JWT a validar',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NzNhMzJlZjk4YzVhZjI3NTJiMjE2NjMiLCJpYXQiOjE3MzQ0NzE1ODMsImV4cCI6MTczNDQ3NTE4M30.example',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}

