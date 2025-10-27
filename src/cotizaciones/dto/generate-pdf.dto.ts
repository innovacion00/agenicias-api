import { IsMongoId, IsNotEmpty } from 'class-validator';

export class GeneratePdfDto {
  @IsMongoId()
  @IsNotEmpty()
  cotizacionId: string;
}
