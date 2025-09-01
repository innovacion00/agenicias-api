import { addDay, format, diffDays } from '@formkit/tempo';

export const calcularFechaLimitePago = (
  fechaCheckin: string,
  isReservaGrupo: boolean = false,
) => {
  const fechaActual = new Date();
  const diasRestantes = diffDays(fechaCheckin, fechaActual);

  // Solo aplicar nueva lógica para reservas con 60 días o más hasta el check-in
  if (diasRestantes >= 60) {
    // Calcular porcentajes según tipo de reserva
    const porcentajePrimeraMitad = isReservaGrupo ? 0.10 : 0.20; // 10% para grupo, 20% para individual
    const porcentajeSegundaMitad = isReservaGrupo ? 0.30 : 0.40; // 30% para grupo, 40% para individual

    // Calcular días para cada fecha límite
    const diasPrimeraMitad = Math.floor(diasRestantes * porcentajePrimeraMitad);
    const diasSegundaMitad = Math.floor(diasRestantes * porcentajeSegundaMitad);

    // Calcular fechas límite
    const fechaLimitePago = format(addDay(fechaActual, diasPrimeraMitad), 'YYYY-MM-DD');
    const fechaLimitePago2 = format(addDay(fechaActual, diasSegundaMitad), 'YYYY-MM-DD');

    return {
      fechaLimitePago,
      fechaLimitePago2,
      diasRestantes,
      diasPrimeraMitad,
      diasSegundaMitad,
      porcentajePrimeraMitad: porcentajePrimeraMitad * 100,
      porcentajeSegundaMitad: porcentajeSegundaMitad * 100,
    };
  }

  // Para reservas con menos de 60 días, mantener lógica anterior
  let fechaLimitePago: string;

  // Para fechas menores a 72 horas pago inmediato
  if (diasRestantes <= 3) {
    fechaLimitePago = format(new Date(), 'YYYY-MM-DD');
  }
  // Para fechas de 4 a 10 dias antes del checkin los pagos deben ser 2 dias antes de la fecha de checkin
  else if (diasRestantes >= 4 && diasRestantes <= 10) {
    fechaLimitePago = format(
      addDay(new Date(), diasRestantes - 2),
      'YYYY-MM-DD',
    );
  }
  // Para fechas de 11 a 30 dias antes del checkin los pagos deben ser 7 dias antes de la fecha de checkin
  else if (diasRestantes >= 11 && diasRestantes <= 30) {
    fechaLimitePago = format(
      addDay(new Date(), diasRestantes - 7),
      'YYYY-MM-DD',
    );
  }
  // Para fechas de 31 a 59 dias el pago debe ser minimo 12 dias antes del checkin
  else {
    fechaLimitePago = format(
      addDay(new Date(), diasRestantes - 12),
      'YYYY-MM-DD',
    );
  }

  // Para reservas cortas, fechaLimitePago2 siempre es 1 día antes del check-in
  const fechaLimitePago2 = format(addDay(fechaCheckin, -1), 'YYYY-MM-DD');

  return {
    fechaLimitePago,
    fechaLimitePago2,
    diasRestantes,
    diasPrimeraMitad: diasRestantes - 12,
    diasSegundaMitad: 1,
    porcentajePrimeraMitad: null,
    porcentajeSegundaMitad: null,
  };
};
