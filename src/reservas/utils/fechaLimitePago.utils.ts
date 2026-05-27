import { addDay, format, diffDays } from '@formkit/tempo';

/** Agencia con regla fija: primera fecha límite de pago = 3 días calendario antes del check-in. */
export const AGENCIA_FECHA_LIMITE_3_DIAS_ANTES_CHECKIN =
  '690b45554b740ff32651801d';

export const calcularFechaLimitePago = (
  fechaCheckin: string,
  isReservaGrupo = false,
  agenciaId?: string | { toString(): string },
) => {
  const fechaActual = new Date();
  const diasRestantes = diffDays(fechaCheckin, fechaActual);

  const agenciaIdStr = agenciaId != null ? String(agenciaId) : '';
  if (agenciaIdStr === AGENCIA_FECHA_LIMITE_3_DIAS_ANTES_CHECKIN) {
    const fechaLimitePago = format(addDay(fechaCheckin, -3), 'YYYY-MM-DD');
    const fechaLimitePago2 = format(addDay(fechaCheckin, -3), 'YYYY-MM-DD');
    return {
      fechaLimitePago,
      fechaLimitePago2,
      diasRestantes,
      diasPrimeraMitad: 3,
      diasSegundaMitad: 1,
      porcentajePrimeraMitad: null,
      porcentajeSegundaMitad: null,
    };
  }

  // Solo aplicar nueva lógica para reservas con 60 días o más hasta el check-in
  if (diasRestantes >= 60) {
    // Calcular porcentajes según tipo de reserva
    const porcentajePrimeraMitad = isReservaGrupo ? 0.1 : 0.5; // 10% para grupo, 50% para individual
    const porcentajeSegundaMitad = isReservaGrupo ? 0.3 : 0.6; // 30% para grupo, 60% para individual

    // Calcular días para cada fecha límite
    const diasPrimeraMitad = Math.floor(diasRestantes * porcentajePrimeraMitad);
    const diasSegundaMitad = Math.floor(diasRestantes * porcentajeSegundaMitad);

    // Calcular fechas límite
    const fechaLimitePago = format(
      addDay(fechaActual, diasPrimeraMitad),
      'YYYY-MM-DD',
    );
    const fechaLimitePago2 = format(
      addDay(fechaActual, diasSegundaMitad),
      'YYYY-MM-DD',
    );

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
