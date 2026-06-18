import { MyToolEstadoCuentaResponse } from '../services/my-tool-booking.service';

export type DecisionMontoReactivacion =
  | { accion: 'generar'; monto: number }
  | { accion: 'cancelar' };

/** Trunca decimales del monto PMS (187425.0000 → 187425). */
export function normalizarMontoPms(monto: number): number {
  return Math.trunc(monto);
}

export function sumarPagosEstadoCuenta(
  resp: Pick<MyToolEstadoCuentaResponse, 'result'>,
): number {
  return (resp.result ?? [])
    .flatMap((item) => item.pagos ?? [])
    .reduce((acc, pago) => acc + normalizarMontoPms(pago.monto), 0);
}

export function decidirMontoReactivacion(args: {
  pagadoPrimeraMitad: boolean;
  total: number;
  totalMitad: number;
  montoPagado: number;
}): DecisionMontoReactivacion {
  const { pagadoPrimeraMitad, total, totalMitad, montoPagado } = args;

  if (pagadoPrimeraMitad) {
    return { accion: 'generar', monto: totalMitad };
  }

  if (montoPagado === totalMitad) {
    return { accion: 'generar', monto: totalMitad };
  }

  if (montoPagado === total) {
    return { accion: 'cancelar' };
  }

  return { accion: 'generar', monto: total - montoPagado };
}
