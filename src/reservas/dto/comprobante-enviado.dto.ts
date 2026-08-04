import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  Matches,
  Max,
} from 'class-validator';

/**
 * Body de POST reservas/comprobante-enviado/:reservaId.
 * El archivo del comprobante no viaja por aquí: se sube desde el motor
 * directamente a Bitrix, y solo se guarda la referencia a la negociación.
 */
export class ComprobanteEnviadoDto {
  /** ID de la negociación creada en Bitrix (crm.deal.add). */
  @IsString()
  @IsNotEmpty()
  bitrixDealId: string;

  /** Monto declarado en el comprobante. */
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(100000000)
  monto: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaConsignacion debe tener formato YYYY-MM-DD',
  })
  fechaConsignacion: string;

  /** Razón social de la cuenta a la que se transfirió. */
  @IsString()
  @IsNotEmpty()
  razonSocial: string;
}
