import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CotizacionStatus } from '../entities/cotizacion.entity';

export class ResponderCotizacionDto {
  @IsEnum(CotizacionStatus, {
    message: 'status debe ser ACEPTADA o RECHAZADA',
  })
  @IsNotEmpty()
  status: CotizacionStatus.ACEPTADA | CotizacionStatus.RECHAZADA;

  @IsString()
  @IsOptional()
  motivoRechazo?: string;
}
