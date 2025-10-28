import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CotizacionStatus } from '../entities/cotizacion.entity';

export class ResponderCotizacionDto {
  @IsEnum([CotizacionStatus.ACEPTADA, CotizacionStatus.RECHAZADA])
  @IsNotEmpty()
  status: CotizacionStatus.ACEPTADA | CotizacionStatus.RECHAZADA;

  @IsString()
  @IsOptional()
  motivoRechazo?: string;
}
