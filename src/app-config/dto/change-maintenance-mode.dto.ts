import { IsBoolean } from 'class-validator';

export class ChangeMaintenanceModeDto {
  @IsBoolean()
  activo: boolean;
}