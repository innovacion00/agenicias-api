import { IsInt, Max, Min } from 'class-validator';

export class UpdateReservaStatusDto {
  @IsInt()
  @Min(0)
  @Max(5)
  status: number;
}

