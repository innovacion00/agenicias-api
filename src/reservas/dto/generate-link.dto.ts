import { IsBoolean, IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';
import { Types } from 'mongoose';

export class GenerateLinkDto {
  @IsMongoId()
  @IsNotEmpty()
  reservaId: Types.ObjectId;

  @IsBoolean()
  @IsOptional()
  pagoTotal: boolean;
}
