import { IsString, IsNotEmpty } from 'class-validator';

export class StoreLandingDto {
  @IsString()
  @IsNotEmpty()
  cotizacionId: string;

  @IsString()
  @IsNotEmpty()
  landingHtml: string;
}
