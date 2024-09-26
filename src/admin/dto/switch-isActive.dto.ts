import { IsBoolean, IsMongoId, IsNotEmpty } from 'class-validator';

export class SwitchIsActiveDto {
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;

  // @IsMongoId()
  // @IsNotEmpty()
  // id: string;
}
