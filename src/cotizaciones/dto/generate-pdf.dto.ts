import { IsString, IsNotEmpty } from 'class-validator';

export class GeneratePdfDto {
  @IsString()
  @IsNotEmpty()
  cotizacionId: string;
}
