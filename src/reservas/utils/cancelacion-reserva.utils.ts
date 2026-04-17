import { ValidPaymentStatus } from '../interfaces';

/**
 * Bloquea la cancelación automática (agencia) solo cuando ya se pagó la primera mitad.
 * Excepciones: pago total (3) o reserva abonada (6) — en esos estados la reserva puede cancelarse.
 */
export function debeBloquearCancelacionPorPrimeraMitadPagada(reserva: {
  pagadoPrimeraMitad?: boolean;
  status: ValidPaymentStatus;
}): boolean {
  if (reserva.status === ValidPaymentStatus.total) {
    return false;
  }
  if (reserva.status === ValidPaymentStatus.reservaAbonada) {
    return false;
  }
  return reserva.pagadoPrimeraMitad === true;
}
