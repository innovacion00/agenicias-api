import { diffDays, format } from '@formkit/tempo';
import { notificacionEmail7Dias } from 'src/config/constants/emailPlantillas';

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

  if (diasRestantes < 1) {
    return {
      vencida: true,
      subject: `Notificacion vencimiento de reserva ${reserva}`,
      // TODO: cambiar a notificacion de cancelacion de reserva
      html: notificacionEmail7Dias(reserva, formatCheckin, formatCheckout),
    };
  }
  if (diasRestantes === 7) {
    return {
      vencida: false,
      subject: `Booking Connect - Notificacion para pago de reserva ${reserva}`,
      html: notificacionEmail7Dias(reserva, formatCheckin, formatCheckout),
    };
  }
};
