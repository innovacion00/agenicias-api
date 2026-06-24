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
  abono: number;
}): DecisionMontoReactivacion {
  const { pagadoPrimeraMitad, total, totalMitad, abono } = args;

  if (pagadoPrimeraMitad) {
    return { accion: 'generar', monto: totalMitad };
  }

  if (abono > 0) {
    const montoRestante = total - abono;
    if (montoRestante <= 0) {
      return { accion: 'cancelar' };
    }
    return { accion: 'generar', monto: montoRestante };
  }

  return { accion: 'generar', monto: total };
}
