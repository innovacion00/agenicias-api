import { format } from '@formkit/tempo';
import { convertidorMoneda } from 'src/common/helpers';
import {
  renderTemplate,
  registerHelpers,
} from 'src/notificaciones/templates/render.helper';

registerHelpers();

// #region Notificaciones reservas

export const notificacionReservaGrupo = (
  agencia: string,
  habitacionNum: number,
  hotel: string,
  checkin: string,
  checkout: string,
  reservaChatbotId: string,
) => {
  return renderTemplate('emails-grupo', {
    agencia,
    habitacionNum,
    hotel,
    checkin,
    checkout,
    reservaChatbotId,
  });
};

export const notificacionEmail7Dias = (
  reserva: string,
  checkin: string,
  checkout: string,
  pagadoPrimeraMitad: boolean,
) => {
  return renderTemplate('emails-recordatorio-7d', {
    reserva,
    checkin,
    checkout,
    pagadoPrimeraMitad,
  });
};

export const notificacionSaldoPendienteIntentoCancelacion = (
  reserva: string,
  checkin: string,
  checkout: string,
) => {
  return renderTemplate('emails-saldo-pendiente', {
    reserva,
    checkin,
    checkout,
  });
};

export const notificacionEmailMenos3Dias = (
  reserva: string,
  checkin: string,
  checkout: string,
  dias: number,
  pagadoPrimeraMitad: boolean,
) => {
  return renderTemplate('emails-recordatorio-3d', {
    reserva,
    checkin,
    checkout,
    dias,
    pagadoPrimeraMitad,
  });
};

export const notificacionEmailUltimoDia = (
  reserva: string,
  checkin: string,
  checkout: string,
) => {
  return renderTemplate('emails-ultimo-dia', {
    reserva,
    checkin,
    checkout,
  });
};

export const notificacionEmailCancelacionReserva = (
  reserva: string,
  checkin: string,
  checkout: string,
) => {
  return renderTemplate('emails-confirmacion-reserva', {
    reserva,
    checkin,
    checkout,
  });
};

// #region Cancelacion

export const notificacionCancelacionVoluntariaReservas = (
  reserva: string,
  agencia: string,
  pagadoPrimeraMitad: boolean,
  saldo: number,
) => {
  const montoFormateado = convertidorMoneda(saldo);
  return renderTemplate('emails-cancelacion-voluntaria', {
    reserva,
    agencia,
    pagadoPrimeraMitad,
    montoFormateado,
  });
};

export const notificacionCancelacionToures = (
  titular: string,
  fechaCheckin: string,
  fechaCheckout: string,
  numeroTelefono: string,
) => {
  return renderTemplate('emails-cancelacion-tours', {
    titular,
    fechaCheckin,
    fechaCheckout,
    numeroTelefono,
  });
};

export const notificacionCancelacionVencimiento = (
  reserva: string,
  agencia: string,
  pagadoPrimeraMitad: boolean,
  fechaLimitePago: string,
  saldo: number,
) => {
  const montoFormateado = convertidorMoneda(saldo);
  const fechaLimitePagoFormateada = format(fechaLimitePago, 'full', 'es-Co');
  return renderTemplate('emails-cancelacion-vencimiento', {
    reserva,
    agencia,
    pagadoPrimeraMitad,
    fechaLimitePagoFormateada,
    montoFormateado,
  });
};

export const notificacionTransporte = (
  textTipoRecogida: string,
  fechaCheckin: string,
  fechaCheckout: string,
  cantidadPersonas: number,
  firstContactNumber: string,
  aerolinea: string,
  numeroVuelo: string,
  titular: string,
  contactoAgencia: string,
  numeroVueloSalida?: string,
  secondContacNumber?: string,
) => {
  return renderTemplate('emails-transporte', {
    textTipoRecogida,
    fechaCheckin,
    fechaCheckout,
    cantidadPersonas,
    firstContactNumber,
    aerolinea,
    numeroVuelo,
    titular,
    contactoAgencia,
    numeroVueloSalida,
    secondContacNumber,
  });
};

export const notificacionToures = (
  nombresToures: string[],
  nombreHotel: string,
  firstContactNumber: string,
  titular: string,
  cantidadPersonas: number,
  secondContacNumber?: string,
) => {
  const tourNames = nombresToures.join(', ');
  return renderTemplate('emails-tours', {
    tourNames,
    nombreHotel,
    firstContactNumber,
    titular,
    cantidadPersonas,
    secondContacNumber,
  });
};

export const notificacionPagoVueloMaarlab = (data: {
  agenciaNombre: string;
  reservaChatbotId: string;
  packageId: string;
  hotel: string;
  titularNombre: string;
  checkin: string;
  checkout: string;
  origenIata: string;
  transactionId: string;
  bookingId: string;
}) => {
  return renderTemplate('emails-pago-vuelo-maarlab', data);
};

export const notificacionReactivacionPagoFallido = (data: {
  hotel: string;
  checkin: string;
  checkout: string;
  reservaChatbotId: string;
  monto: number;
  expiraEn: Date;
}) => {
  const montoFormateado = convertidorMoneda(data.monto);
  const plazoLimite = `${format(data.expiraEn, 'DD/MM/YYYY', 'es-Co')} a las ${format(
    data.expiraEn,
    'h:mm a',
    'es-Co',
  )}`;

  return renderTemplate('emails-reactivacion-fallido', {
    hotel: data.hotel,
    checkin: data.checkin,
    checkout: data.checkout,
    reservaChatbotId: data.reservaChatbotId,
    montoFormateado,
    plazoLimite,
  });
};
