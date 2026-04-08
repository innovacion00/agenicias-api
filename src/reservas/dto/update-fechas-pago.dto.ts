import { Matches } from 'class-validator';

export class UpdateFechasPagoDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaLimitePago debe tener formato YYYY-MM-DD',
  })
  fechaLimitePago: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaLimitePago2 debe tener formato YYYY-MM-DD',
  })
  fechaLimitePago2: string;
}
