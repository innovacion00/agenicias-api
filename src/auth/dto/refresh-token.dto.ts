import { IsMongoId, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @IsMongoId()
  @IsNotEmpty()
  _id: string;
}
