import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class ActualizarAbonoDto {
  @ApiProperty({
    description: 'Monto abonado por fuera de la plataforma',
    example: 500000,
    type: Number,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'El abono no puede ser negativo' })
  abono: number;
}
