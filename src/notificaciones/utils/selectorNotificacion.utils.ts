import { diffDays, diffHours, format } from '@formkit/tempo';
import {
  notificacionEmail7Dias,
  notificacionEmailCancelacionReserva,
  notificacionEmailMenos3Dias,
  notificacionEmailUltimoDia,
} from 'src/config';

export const selectorNotificacion = (
  reserva: string,
  fechaLimitePago: string,
  pagadoPrimeraMitad: boolean,
  checkin: string,
  checkout: string,
) => {
  const fechaActual = new Date();
  const diasRestantes = diffDays(fechaLimitePago, fechaActual);
  const horasRestantes = diffHours(fechaLimitePago, fechaActual);
  const formatCheckin = format(checkin, 'full', 'es');
  const formatCheckout = format(checkout, 'full', 'es');

  if (diasRestantes === 7) {
    return {
      tipoAviso: '7_dias',
      vencida: false,
      subject: `Booking Connect - Notificacion para pago de reserva ${reserva}`,
      html: notificacionEmail7Dias(
        reserva,
        formatCheckin,
        formatCheckout,
        pagadoPrimeraMitad,
      ),
    };
  }

  if (diasRestantes >= 1 && diasRestantes <= 3) {
    return {
      tipoAviso: '3_a_1_dias',
      vencida: false,
      subject: `Booking Connect - Notificacion para pago de reserva ${reserva}`,
      html: notificacionEmailMenos3Dias(
        reserva,
        formatCheckin,
        formatCheckout,
        diasRestantes,
        pagadoPrimeraMitad,
      ),
    };
  }

  if (diasRestantes === 0 && horasRestantes < 0) {
    return {
      tipoAviso: 'ultimo_dia',
      vencida: false,
      subject: `Booking Connect - Notificacion para pago de reserva ${reserva}`,
      html: notificacionEmailUltimoDia(reserva, formatCheckin, formatCheckout),
    };
  }

  if (diasRestantes < 0) {
    return {
      tipoAviso: 'vencida',
      vencida: true,
      subject: `Booking Connect - Notificacion vencimiento de reserva ${reserva}`,
      html: notificacionEmailCancelacionReserva(
        reserva,
        formatCheckin,
        formatCheckout,
      ),
    };
  }

  return {
    tipoAviso: 'no_valida',
    noValid: true,
  };
};
