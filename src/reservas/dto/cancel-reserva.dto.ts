import { IsMongoId, IsNotEmpty } from 'class-validator';
import { Types } from 'mongoose';

export class CancelReservaDto {
  @IsMongoId()
  @IsNotEmpty()
  reservaId: Types.ObjectId;
}
