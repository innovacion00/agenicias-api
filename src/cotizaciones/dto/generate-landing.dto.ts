import { IsString, IsNotEmpty } from 'class-validator';

export class GenerateLandingDto {
  @IsString()
  @IsNotEmpty()
  cotizacionId: string;
}
