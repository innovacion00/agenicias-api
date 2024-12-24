import { IsMongoId, IsNotEmpty } from 'class-validator';
import { Types } from 'mongoose';

export class GenerateLinkDto {
  @IsMongoId()
  @IsNotEmpty()
  reservaId: Types.ObjectId;
}
