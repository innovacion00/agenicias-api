import { ValidPaymentStatus } from '../interfaces';

/**
 * Bloquea la cancelación por flujo de agencia cuando `pagadoPrimeraMitad` es true,
 * excepto si el status es 6 (reserva abonada), donde sí se permite cancelar.
 *
 * Incluye el caso status 3 (total) con `pagadoPrimeraMitad === true`: no se cancela.
 */
export function debeBloquearCancelacionPorPrimeraMitadPagada(reserva: {
  pagadoPrimeraMitad?: boolean;
  status: ValidPaymentStatus;
}): boolean {
  if (reserva.status === ValidPaymentStatus.reservaAbonada) {
    return false;
  }
  return reserva.pagadoPrimeraMitad === true;
}
