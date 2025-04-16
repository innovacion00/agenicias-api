import { addDay, format } from '@formkit/tempo';

export const calcularFechaLimitePago = (actualDiffDays: number) => {
  let fechaLimitePago: string;
  //? Para fechas menores a 72 horas pago inmediato
  if (actualDiffDays <= 3) {
    fechaLimitePago = format(new Date(), 'YYYY-MM-DD');
  }
  //? Para fechas de 4 a 10 dias antes del checkin los pagos deben ser 2 dias antes de la fecha de checkin
  else if (actualDiffDays >= 4 && actualDiffDays <= 10) {
    fechaLimitePago = format(
      addDay(new Date(), actualDiffDays - 2),
      'YYYY-MM-DD',
    );
  }
  //? Para fechas de 11 a 30 dias antes del checkin los pagos deben ser 7 dias antes de la fecha de checkin
  else if (actualDiffDays >= 11 && actualDiffDays <= 30) {
    fechaLimitePago = format(
      addDay(new Date(), actualDiffDays - 7),
      'YYYY-MM-DD',
    );
  }
  //? Para fechas mayores 31 dias el pago debe ser minimo 12 dias antes del checkin
  else {
    fechaLimitePago = format(
      addDay(new Date(), actualDiffDays - 12),
      'YYYY-MM-DD',
    );
  }

  return fechaLimitePago;
};
