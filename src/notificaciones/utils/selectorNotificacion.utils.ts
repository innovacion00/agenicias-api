import { diffDays, format } from '@formkit/tempo';
import {
  notificacionEmail7Dias,
  notificacionEmailCancelacionReserva,
  notificacionEmailMenos3Dias,
  notificacionEmailUltimoDia,
} from 'src/config/constants/emailPlantillas';

export const selecteroNotificacion = (
  reserva: string,
  fechaLimitePago: string,
  checkin: string,
  checkout: string,
) => {
  const fechaActual = new Date();
  const diasRestantes = diffDays(fechaLimitePago, fechaActual);
  const formatCheckin = format(checkin, 'full', 'es');
  const formatCheckout = format(checkout, 'full', 'es');

  if (diasRestantes === 7) {
    return {
      vencida: false,
      subject: `Booking Connect - Notificacion para pago de reserva ${reserva}`,
      html: notificacionEmail7Dias(reserva, formatCheckin, formatCheckout),
    };
  }

  if (diasRestantes >= 1 && diasRestantes <= 3) {
    return {
      vencida: false,
      subject: `Booking Connect - Notificacion para pago de reserva ${reserva}`,
      html: notificacionEmailMenos3Dias(
        reserva,
        formatCheckin,
        formatCheckout,
        diasRestantes,
      ),
    };
  }

  if (diasRestantes === 0) {
    return {
      vencida: false,
      subject: `Booking Connect - Notificacion para pago de reserva ${reserva}`,
      html: notificacionEmailUltimoDia(reserva, formatCheckin, formatCheckout),
    };
  }

  if (diasRestantes < 0) {
    return {
      vencida: true,
      subject: `Booking Connect - Notificacion vencimiento de reserva ${reserva}`,
      html: notificacionEmailCancelacionReserva(
        reserva,
        formatCheckin,
        formatCheckout,
      ),
    };
  }
};
