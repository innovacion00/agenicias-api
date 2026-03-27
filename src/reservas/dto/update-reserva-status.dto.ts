import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateReservaStatusDto {
  /** Coerce a número (form-data / clientes que envían string). */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  status: number;
}

