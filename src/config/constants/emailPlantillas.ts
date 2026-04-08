import { format } from '@formkit/tempo';
import { convertidorMoneda } from 'src/common/helpers';

// #region Notificaciones reservas

export const notificaiconReservaGrupo = (
  agencia: string,
  habitacionNum: number,
  hotel: string,
  checkin: string,
  checkout: string,
  reservaChatbotId: string,
) => {
  return `
  <!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nueva Reserva de Grupo</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 5px;
      overflow: hidden;
    }
    .email-header {
      background-color: #28a745;
      color: #ffffff;
      text-align: center;
      padding: 20px;
    }
    .email-header h1 {
      margin: 0;
      font-size: 24px;
    }
    .email-body {
      padding: 20px;
      line-height: 1.6;
      color: #333333;
    }
    .email-footer {
      background-color: #f4f4f4;
      text-align: center;
      padding: 10px;
      font-size: 12px;
      color: #777777;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>Nueva Reserva de Grupo</h1>
    </div>
    <div class="email-body">
      <p>Estimado equipo de reservas,</p>
      <p>La agencia <strong>${agencia}</strong> ha realizado una nueva reserva de grupo con los siguientes detalles:</p>
      <ul>
        <li><strong>Número de habitaciones:</strong> ${habitacionNum}</li>
        <li><strong>Hotel:</strong> ${hotel}</li>
        <li><strong>Check-in:</strong> ${checkin}</li>
        <li><strong>Check-out:</strong> ${checkout}</li>
        <li><strong>Codigo de reserva:</strong> ${reservaChatbotId}</li>
      </ul>
      <p>Por favor, gestionen la reserva en el sistema y realicen el seguimiento correspondiente.</p>
      <p>Saludos cordiales,<br>El equipo de Geh Suites</p>
    </div>
    <div class="email-footer">
      <p>© ${new Date().getFullYear()} Geh Suites. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>
  `;
};

export const notificacionEmail7Dias = (
  reserva: string,
  checkin: string,
  checkout: string,
  pagadoPrimeraMitad: boolean,
) => {
  if (!pagadoPrimeraMitad) {
    return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recordatorio de Pago de Reserva</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f4f4f4;
        margin: 0;
        padding: 0;
      }
      .email-container {
        max-width: 600px;
        margin: 20px auto;
        background-color: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 5px;
        overflow: hidden;
      }
      .email-header {
        background-color: #cc8831;
        color: #ffffff;
        text-align: center;
        padding: 20px;
      }
      .email-header h1 {
        margin: 0;
        font-size: 24px;
      }
      .email-body {
        padding: 20px;
        line-height: 1.6;
        color: #333333;
      }
      .email-body a {
        color:#ffffff;
        text-decoration: none;
      }
      .email-body a:hover {
        text-decoration: underline;
      }
      .email-footer {
        background-color: #f4f4f4;
        text-align: center;
        padding: 10px;
        font-size: 12px;
        color: #777777;
      }
      .button {
        display: inline-block;
        padding: 10px 20px;
        margin-top: 20px;
        color: #ffffff;
        background-color: #9d6a26;
        text-decoration: none;
        border-radius: 5px;
        font-size: 16px;
      }
      .button:hover {
        background-color: #cc8831;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="email-header">
        <h1>Recordatorio de Primer Pago de Reserva</h1>
      </div>
      <div class="email-body">
        <p>Booking connect le informa que:</p>
        <p>La reserva que realizó con el código <strong>${reserva}</strong>, para las fechas:</p>
        <ul>
          <li><strong>Check-in:</strong> ${checkin}</li>
          <li><strong>Check-out:</strong> ${checkout}</li>
        </ul>
        <p>se encuentra a <strong>1 semana</strong> de alcanzar la fecha límite de pago para su primer abono.</p>
        <p>Por favor, proceda a realizar el primer pago cuanto antes para asegurar su reserva. Puede gestionar su reserva directamente haciendo clic en el siguiente enlace:</p>
        <a href="https://agencia.gehsuites.com/gestionar/${reserva}" class="button">Gestionar mi Reserva</a>
        <p>Si tiene alguna duda o necesita asistencia, no dude en ponerse en contacto con nuestro equipo de reservas reservas@gehsuites.com.</p>
        <p>Por favor no responder este correo.</p>
        <p>Saludos cordiales,<br>El equipo de Geh Suites</p>
      </div>
      <div class="email-footer">
        <p>© ${new Date().getFullYear()} Geh Suites. Todos los derechos reservados.</p>
      </div>
    </div>
  </body>
  </html>
  `;
  } else {
    return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recordatorio de Pago de Reserva</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f4f4f4;
        margin: 0;
        padding: 0;
      }
      .email-container {
        max-width: 600px;
        margin: 20px auto;
        background-color: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 5px;
        overflow: hidden;
      }
      .email-header {
        background-color: #cc8831;
        color: #ffffff;
        text-align: center;
        padding: 20px;
      }
      .email-header h1 {
        margin: 0;
        font-size: 24px;
      }
      .email-body {
        padding: 20px;
        line-height: 1.6;
        color: #333333;
      }
      .email-body a {
        color:#ffffff;
        text-decoration: none;
      }
      .email-body a:hover {
        text-decoration: underline;
      }
      .email-footer {
        background-color: #f4f4f4;
        text-align: center;
        padding: 10px;
        font-size: 12px;
        color: #777777;
      }
      .button {
        display: inline-block;
        padding: 10px 20px;
        margin-top: 20px;
        color: #ffffff;
        background-color: #9d6a26;
        text-decoration: none;
        border-radius: 5px;
        font-size: 16px;
      }
      .button:hover {
        background-color: #cc8831;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="email-header">
        <h1>Recordatorio de Pago final de Reserva</h1>
      </div>
      <div class="email-body">
        <p>Booking connect le informa que:</p>
        <p>La reserva que realizó con el código <strong>${reserva}</strong>, para las fechas:</p>
        <ul>
          <li><strong>Check-in:</strong> ${checkin}</li>
          <li><strong>Check-out:</strong> ${checkout}</li>
        </ul>
        <p>se encuentra a <strong>1 semana</strong> de alcanzar la fecha límite de pago final.</p>
        <p>Por favor, proceda a realizar el ultimo pago cuanto antes para concretar su reserva. Puede gestionar su reserva directamente haciendo clic en el siguiente enlace:</p>
        <a href="https://agencia.gehsuites.com/gestionar/${reserva}" class="button">Gestionar mi Reserva</a>
        <p>Si tiene alguna duda o necesita asistencia, no dude en ponerse en contacto con nuestro equipo de reservas reservas@gehsuites.com.</p>
        <p>Por favor no responder este correo.</p>
        <p>Saludos cordiales,<br>El equipo de Geh Suites</p>
      </div>
      <div class="email-footer">
        <p>© ${new Date().getFullYear()} Geh Suites. Todos los derechos reservados.</p>
      </div>
    </div>
  </body>
  </html>
  `;
  }
};

export const notificacionEmailMenos3Dias = (
  reserva: string,
  checkin: string,
  checkout: string,
  dias: number,
  pagadoPrimeraMitad: boolean,
) => {
  if (!pagadoPrimeraMitad) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recordatorio de Pago de Reserva</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 5px;
      overflow: hidden;
    }
    .email-header {
      background-color: #cc8831;
      color: #ffffff;
      text-align: center;
      padding: 20px;
    }
    .email-header h1 {
      margin: 0;
      font-size: 24px;
    }
    .email-body {
      padding: 20px;
      line-height: 1.6;
      color: #333333;
    }
    .email-body a {
      color:#ffffff;
      text-decoration: none;
    }
    .email-body a:hover {
      text-decoration: underline;
    }
    .email-footer {
      background-color: #f4f4f4;
      text-align: center;
      padding: 10px;
      font-size: 12px;
      color: #777777;
    }
    .button {
      display: inline-block;
      padding: 10px 20px;
      margin-top: 20px;
      color: #ffffff;
      background-color: #9d6a26;
      text-decoration: none;
      border-radius: 5px;
      font-size: 16px;
    }
    .button:hover {
      background-color: #cc8831;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>Recordatorio de Primer Pago de Reserva</h1>
    </div>
    <div class="email-body">
      <p>Booking connect le informa que:</p>
      <p>La reserva que realizó con el código <strong>${reserva}</strong>, para las fechas:</p>
      <ul>
        <li><strong>Check-in:</strong> ${checkin}</li>
        <li><strong>Check-out:</strong> ${checkout}</li>
      </ul>
      <p>se encuentra a <strong>${dias} ${dias > 1 ? 'dias' : 'dia'}</strong> de alcanzar la fecha límite de pago para su primer abono.</p>
      <p>Por favor, proceda a realizar el pago cuanto antes para asegurar su reserva. Puede gestionar su reserva directamente haciendo clic en el siguiente enlace:</p>
      <a href="https://agencia.gehsuites.com/gestionar/${reserva}" class="button">Gestionar mi Reserva</a>
      <p>Si tiene alguna duda o necesita asistencia, no dude en ponerse en contacto con nuestro equipo de reservas reservas@gehsuites.com.</p>
      <p>Por favor no responder este correo.</p>
      <p>Saludos cordiales,<br>El equipo de Geh Suites</p>
    </div>
    <div class="email-footer">
      <p>© ${new Date().getFullYear()} Geh Suites. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>
`;
  } else {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recordatorio de Pago de Reserva</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 5px;
      overflow: hidden;
    }
    .email-header {
      background-color: #cc8831;
      color: #ffffff;
      text-align: center;
      padding: 20px;
    }
    .email-header h1 {
      margin: 0;
      font-size: 24px;
    }
    .email-body {
      padding: 20px;
      line-height: 1.6;
      color: #333333;
    }
    .email-body a {
      color:#ffffff;
      text-decoration: none;
    }
    .email-body a:hover {
      text-decoration: underline;
    }
    .email-footer {
      background-color: #f4f4f4;
      text-align: center;
      padding: 10px;
      font-size: 12px;
      color: #777777;
    }
    .button {
      display: inline-block;
      padding: 10px 20px;
      margin-top: 20px;
      color: #ffffff;
      background-color: #9d6a26;
      text-decoration: none;
      border-radius: 5px;
      font-size: 16px;
    }
    .button:hover {
      background-color: #cc8831;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>Recordatorio de Pago Final de Reserva</h1>
    </div>
    <div class="email-body">
      <p>Booking connect le informa que:</p>
      <p>La reserva que realizó con el código <strong>${reserva}</strong>, para las fechas:</p>
      <ul>
        <li><strong>Check-in:</strong> ${checkin}</li>
        <li><strong>Check-out:</strong> ${checkout}</li>
      </ul>
      <p>se encuentra a <strong>${dias} ${dias > 1 ? 'dias' : 'dia'}</strong> de alcanzar la fecha límite de pago final.</p>
      <p>Por favor, proceda a realizar el pago cuanto antes para concretar su reserva. Puede gestionar su reserva directamente haciendo clic en el siguiente enlace:</p>
      <a href="https://agencia.gehsuites.com/gestionar/${reserva}" class="button">Gestionar mi Reserva</a>
      <p>Si tiene alguna duda o necesita asistencia, no dude en ponerse en contacto con nuestro equipo de reservas reservas@gehsuites.com.</p>
      <p>Por favor no responder este correo.</p>

      <p>Saludos cordiales,<br>El equipo de Geh Suites</p>
    </div>
    <div class="email-footer">
      <p>© ${new Date().getFullYear()} Geh Suites. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>
`;
  }
};

export const notificacionEmailUltimoDia = (
  reserva: string,
  checkin: string,
  checkout: string,
) => {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recordatorio de Pago de Reserva</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 5px;
      overflow: hidden;
    }
    .email-header {
      background-color: #cc8831;
      color: #ffffff;
      text-align: center;
      padding: 20px;
    }
    .email-header h1 {
      margin: 0;
      font-size: 24px;
    }
    .email-body {
      padding: 20px;
      line-height: 1.6;
      color: #333333;
    }
    .email-body a {
      color:#ffffff;
      text-decoration: none;
    }
    .email-body a:hover {
      text-decoration: underline;
    }
    .email-footer {
      background-color: #f4f4f4;
      text-align: center;
      padding: 10px;
      font-size: 12px;
      color: #777777;
    }
    .button {
      display: inline-block;
      padding: 10px 20px;
      margin-top: 20px;
      color: #ffffff;
      background-color: #9d6a26;
      text-decoration: none;
      border-radius: 5px;
      font-size: 16px;
    }
    .button:hover {
      background-color: #cc8831;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>Recordatorio de Pago de Reserva</h1>
    </div>
    <div class="email-body">
      <p>Booking connect le informa que:</p>
      <p>La reserva que realizó con el código <strong>${reserva}</strong>, para las fechas:</p>
      <ul>
        <li><strong>Check-in:</strong> ${checkin}</li>
        <li><strong>Check-out:</strong> ${checkout}</li>
      </ul>
      <p>se encuentra en <strong>la fecha límite de pago</strong>.</p>
      <p>Por favor, proceda a realizar el pago cuanto antes para asegurar su reserva de lo contrario esta sera <strong>CANCELADA</strong>. Puede gestionar su reserva directamente haciendo clic en el siguiente enlace:</p>
      <a href="https://agencia.gehsuites.com/gestionar/${reserva}" class="button">Gestionar mi Reserva</a>
      <p>Si tiene alguna duda o necesita asistencia, no dude en ponerse en contacto con nuestro equipo de reservas reservas@gehsuites.com.</p>
      <p>Por favor no responder este correo.</p>
      <p>Saludos cordiales,<br>El equipo de Geh Suites</p>
    </div>
    <div class="email-footer">
      <p>© ${new Date().getFullYear()} Geh Suites. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>
`;
};

export const notificacionEmailCancelacionReserva = (
  reserva: string,
  checkin: string,
  checkout: string,
) => {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recordatorio de Pago de Reserva</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 5px;
      overflow: hidden;
    }
    .email-header {
      background-color: #cc8831;
      color: #ffffff;
      text-align: center;
      padding: 20px;
    }
    .email-header h1 {
      margin: 0;
      font-size: 24px;
    }
    .email-body {
      padding: 20px;
      line-height: 1.6;
      color: #333333;
    }
    .email-body a {
      color:#ffffff;
      text-decoration: none;
    }
    .email-body a:hover {
      text-decoration: underline;
    }
    .email-footer {
      background-color: #f4f4f4;
      text-align: center;
      padding: 10px;
      font-size: 12px;
      color: #777777;
    }
    .button {
      display: inline-block;
      padding: 10px 20px;
      margin-top: 20px;
      color: #ffffff;
      background-color: #9d6a26;
      text-decoration: none;
      border-radius: 5px;
      font-size: 16px;
    }
    .button:hover {
      background-color: #cc8831;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>Reserva cancelada</h1>
    </div>
    <div class="email-body">
      <p>Booking connect le informa que:</p>
      <p>La reserva que realizó con el código <strong>${reserva}</strong>, para las fechas:</p>
      <ul>
        <li><strong>Check-in:</strong> ${checkin}</li>
        <li><strong>Check-out:</strong> ${checkout}</li>
      </ul>
      <p>se encuentra <strong>CANCELADA</strong> por falta de pago a tiempo oportuno.</p>
      <p>Si tiene alguna duda o necesita asistencia, no dude en ponerse en contacto con nuestro equipo de reservas reservas@gehsuites.com.</p>
      <p>Por favor no responder este correo.</p>
      <p>Saludos cordiales,<br>El equipo de Geh Suites</p>
    </div>
    <div class="email-footer">
      <p>© ${new Date().getFullYear()} Geh Suites. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>
`;
};

// #region Cancelacion
//? Mensaje para el equipo de reservas
export const notificacionCancelacionVoluntariaReservas = (
  reserva: string,
  agencia: string,
  pagadoPrimeraMitad: boolean,
  saldo: number,
) => {
  const montoFormateado = convertidorMoneda(saldo);

  if (!pagadoPrimeraMitad) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notificación de Cancelación de Reserva</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 5px;
      overflow: hidden;
    }
    .email-header {
      background-color: #d9534f;
      color: #ffffff;
      text-align: center;
      padding: 20px;
    }
    .email-header h1 {
      margin: 0;
      font-size: 24px;
    }
    .email-body {
      padding: 20px;
      line-height: 1.6;
      color: #333333;
    }
    .email-body a {
      color: #d9534f;
      text-decoration: none;
    }
    .email-body a:hover {
      text-decoration: underline;
    }
    .email-footer {
      background-color: #f4f4f4;
      text-align: center;
      padding: 10px;
      font-size: 12px;
      color: #777777;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>Notificación de Cancelación de Reserva</h1>
    </div>
    <div class="email-body">
      <p>Estimado equipo de reservas,</p>
      <p>La agencia <strong>${agencia}</strong> ha cancelado una reserva con el siguiente detalle:</p>
      <ul>
        <li><strong>Código de Reserva:</strong> ${reserva}</li>
      </ul>
      <p>Les solicitamos si es necesario, contactar a la agencia para confirmar cualquier detalle adicional.</p>
      <p>Saludos cordiales,<br>El equipo de innovacion y desarrollo de Geh Suites</p>
    </div>
    <div class="email-footer">
      <p>© ${new Date().getFullYear()} Geh Suites. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>
`;
  } else {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notificación de Cancelación de Reserva</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 5px;
      overflow: hidden;
    }
    .email-header {
      background-color: #d9534f;
      color: #ffffff;
      text-align: center;
      padding: 20px;
    }
    .email-header h1 {
      margin: 0;
      font-size: 24px;
    }
    .email-body {
      padding: 20px;
      line-height: 1.6;
      color: #333333;
    }
    .email-body a {
      color: #d9534f;
      text-decoration: none;
    }
    .email-body a:hover {
      text-decoration: underline;
    }
    .email-footer {
      background-color: #f4f4f4;
      text-align: center;
      padding: 10px;
      font-size: 12px;
      color: #777777;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>Notificación de Cancelación de Reserva</h1>
    </div>
    <div class="email-body">
      <p>Estimado equipo de reservas,</p>
      <p>La agencia <strong>${agencia}</strong> ha cancelado una reserva con el siguiente detalle:</p>
      <ul>
        <li><strong>Código de Reserva:</strong> ${reserva}</li>
      </ul>
      <p><strong>Detalles: </strong>Cancelado voluntariamente pero se pago la primera mitad de la reserva.</p>
      <p><strong>Saldo a favor de esta reserva: </strong>${montoFormateado}.</p>
      <p>Les solicitamos si es necesario, contactar a la agencia para confirmar cualquier detalle adicional y estar pendiente a cualquier duda de la agencia.</p>
      <p>Saludos cordiales,<br>El equipo de innovacion y desarrollo de Geh Suites</p>
    </div>
    <div class="email-footer">
      <p>© ${new Date().getFullYear()} Geh Suites. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>
`;
  }
};

export const notificacionCancelacionToures = (
  titular: string,
  fechaCheckin: string,
  fechaCheckout: string,
  numeroTelefono: string,
) => {
  return `
  <!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Cancelación de servicio</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f8f8f8;
      margin: 0;
      padding: 0;
    }
    .email-container {
      max-width: 600px;
      margin: 30px auto;
      background-color: #ffffff;
      border: 1px solid #dddddd;
      border-radius: 8px;
      overflow: hidden;
    }
    .email-header {
      background-color: #cc8831;
      color: #ffffff;
      padding: 20px;
      text-align: center;
    }
    .email-header h2 {
      margin: 0;
      font-size: 22px;
    }
    .email-body {
      padding: 20px;
      color: #333333;
      line-height: 1.6;
    }
    .email-body p {
      margin: 0 0 10px;
    }
    .email-footer {
      background-color: #f4f4f4;
      text-align: center;
      padding: 10px;
      font-size: 12px;
      color: #888888;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h2>Cancelación de servicio</h2>
    </div>
    <div class="email-body">
      <p>Hola,</p>

      <p><strong>Geh Suites</strong> les informa que la reserva realizada a nombre de <strong>${titular}</strong> ha sido cancelada.</p>

      <p>Detalles de la reserva cancelada:</p>
      <ul>
        <li><strong>Fecha de Check-in:</strong> ${fechaCheckin}</li>
        <li><strong>Fecha de Check-out:</strong> ${fechaCheckout}</li>
      </ul>

      <p>Por consiguiente, solicitamos cancelar el servicio de transporte o tour asociado a esta reserva, ya que no será requerido.</p>

      <p>Agradecemos su comprensión y apoyo en la gestión de esta solicitud.</p>

      <p><strong>Ante cualquier duda o inconveniente, por favor contactar al correo 
      <a href="mailto:reservas@gehsuites.com">reservas@gehsuites.com</a> o llamar al número <strong>${numeroTelefono}</strong>.</strong></p>

      <p>Gracias,<br>Equipo Geh Suites</p>
    </div>
    <div class="email-footer">
      <p>©${new Date().getFullYear()} Geh Suites. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>

  `;
};

export const notificacionCancelacionVencimiento = (
  reserva: string,
  agencia: string,
  pagadoPrimeraMitad: boolean,
  fechaLimitePago: string,
  saldo: number,
) => {
  const montoFormateado = convertidorMoneda(saldo);

  if (!pagadoPrimeraMitad) {
    return `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Notificación de Cancelación de Reserva</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .email-container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #ffffff;
          border: 1px solid #e0e0e0;
          border-radius: 5px;
          overflow: hidden;
        }
        .email-header {
          background-color: #d9534f;
          color: #ffffff;
          text-align: center;
          padding: 20px;
        }
        .email-header h1 {
          margin: 0;
          font-size: 24px;
        }
        .email-body {
          padding: 20px;
          line-height: 1.6;
          color: #333333;
        }
        .email-body a {
          color: #d9534f;
          text-decoration: none;
        }
        .email-body a:hover {
          text-decoration: underline;
        }
        .email-footer {
          background-color: #f4f4f4;
          text-align: center;
          padding: 10px;
          font-size: 12px;
          color: #777777;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-header">
          <h1>Notificación de Cancelación de Reserva</h1>
        </div>
        <div class="email-body">
          <p>Estimado equipo de reservas,</p>
          <p>A la agencia <strong>${agencia}</strong> se le ha cancelado una reserva con el siguiente detalle:</p>
          <ul>
            <li><strong>Código de Reserva:</strong> ${reserva}</li>
            <li><strong>Fecha limite de pago:</strong> ${format(fechaLimitePago, 'full', 'es-Co')}</li>
          </ul>
          <p><strong>Detalles: </strong>Cancelado debido a falta de pago oportuno de su primer pago.</p>
          <p>Les solicitamos si es necesario, contactar a la agencia para confirmar cualquier detalle adicional.</p>
          <p>Saludos cordiales,<br>El equipo de innovacion y desarrollo de Geh Suites</p>
        </div>
        <div class="email-footer">
          <p>© ${new Date().getFullYear()} Geh Suites. Todos los derechos reservados.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  } else {
    return `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Notificación de Cancelación de Reserva</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .email-container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #ffffff;
          border: 1px solid #e0e0e0;
          border-radius: 5px;
          overflow: hidden;
        }
        .email-header {
          background-color: #d9534f;
          color: #ffffff;
          text-align: center;
          padding: 20px;
        }
        .email-header h1 {
          margin: 0;
          font-size: 24px;
        }
        .email-body {
          padding: 20px;
          line-height: 1.6;
          color: #333333;
        }
        .email-body a {
          color: #d9534f;
          text-decoration: none;
        }
        .email-body a:hover {
          text-decoration: underline;
        }
        .email-footer {
          background-color: #f4f4f4;
          text-align: center;
          padding: 10px;
          font-size: 12px;
          color: #777777;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-header">
          <h1>Notificación de Cancelación de Reserva</h1>
        </div>
        <div class="email-body">
          <p>Estimado equipo de reservas,</p>
          <p>A la agencia <strong>${agencia}</strong> se le ha cancelado una reserva con el siguiente detalle:</p>
          <ul>
            <li><strong>Código de Reserva:</strong> ${reserva}</li>
            <li><strong>Fecha limite de pago:</strong> ${format(fechaLimitePago, 'full', 'es-Co')}</li>
          </ul>
          <p><strong>Detalles: </strong>Cancelado debido al no pago de la segunda mitad de la reserva.</p>
          <p><strong>Saldo a favor de esta reserva: </strong>${montoFormateado}.</p>
          <p>Les solicitamos si es necesario, contactar a la agencia para confirmar cualquier detalle adicional y estar pendiente en caso de consultas.</p>
          <p>Saludos cordiales,<br>El equipo de innovacion y desarrollo de Geh Suites</p>
        </div>
        <div class="email-footer">
          <p>©${new Date().getFullYear()} Geh Suites. Todos los derechos reservados.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }
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
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Solicitud de traslado</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f8f8f8;
      margin: 0;
      padding: 0;
    }
    .email-container {
      max-width: 600px;
      margin: 30px auto;
      background-color: #ffffff;
      border: 1px solid #dddddd;
      border-radius: 8px;
      overflow: hidden;
    }
    .email-header {
      background-color: #cc8831;
      color: #ffffff;
      padding: 20px;
      text-align: center;
    }
    .email-header h2 {
      margin: 0;
      font-size: 22px;
    }
    .email-body {
      padding: 20px;
      color: #333333;
      line-height: 1.6;
    }
    .email-body p {
      margin: 0 0 10px;
    }
    .advertencia {
      background-color: #fff3cd;
      border: 1px solid #ffeeba;
      padding: 15px;
      border-radius: 6px;
      color: #856404;
      font-weight: bold;
      margin: 20px 0;
    }
    .email-footer {
      background-color: #f4f4f4;
      text-align: center;
      padding: 10px;
      font-size: 12px;
      color: #888888;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h2>Solicitud de traslado</h2>
    </div>
    <div class="email-body">
      <p>Hola,</p>
      <p>Se ha solicitado un servicio de traslado con los siguientes datos:</p>

      <ul>
        <li><strong>Titular de la reserva:</strong> ${titular}</li>
        <li><strong>Número de contacto principal:</strong> ${firstContactNumber}</li>
        <li><strong>Tipo de recogida:</strong> ${textTipoRecogida} (Compartido)</li>
        <li><strong>Fecha de Check-in:</strong> ${fechaCheckin}</li>
        <li><strong>Fecha de Check-out:</strong> ${fechaCheckout}</li>
        <li><strong>Cantidad de personas:</strong> ${cantidadPersonas}</li>
        <li><strong>Segundo número de contacto:</strong> ${secondContacNumber || 'no incluyó'}</li>
        <li><strong>Aerolínea:</strong> ${aerolinea}</li>
        <li><strong>Número de vuelo de llegada:</strong> ${numeroVuelo}</li>
        <li><strong>Número de vuelo de salida:</strong> ${numeroVueloSalida || 'no incluyó'}</li>
      </ul>

      <p>Por favor, confirmar la disponibilidad y proceder con la coordinación del servicio.</p>

      <div class="advertencia">
        Importante: confirmar llamando al siguiente número <a href="tel:${contactoAgencia}">${contactoAgencia}</a>
      </div>

      <p><strong>Ante cualquier duda o inconveniente, por favor contactar al correo <a href="mailto:reservas@gehsuites.com">reservas@gehsuites.com</a>.</strong></p>

      <p>Gracias,<br>Equipo Geh Suites</p>
    </div>
    <div class="email-footer">
      <p>©${new Date().getFullYear()} Geh Suites. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>

  `;
};

export const notificacionToures = (
  nombresToures: string[],
  nombreHotel: string,
  firstContactNumber: string,
  titular: string,
  cantidadPersonas: number,
  secondContacNumber?: string,
) => {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Solicitud de toures</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f8f8f8;
      margin: 0;
      padding: 0;
    }
    .email-container {
      max-width: 600px;
      margin: 30px auto;
      background-color: #ffffff;
      border: 1px solid #dddddd;
      border-radius: 8px;
      overflow: hidden;
    }
    .email-header {
      background-color: #cc8831;
      color: #ffffff;
      padding: 20px;
      text-align: center;
    }
    .email-header h2 {
      margin: 0;
      font-size: 22px;
    }
    .email-body {
      padding: 20px;
      color: #333333;
      line-height: 1.6;
    }
    .email-body p {
      margin: 0 0 10px;
    }
    .email-footer {
      background-color: #f4f4f4;
      text-align: center;
      padding: 10px;
      font-size: 12px;
      color: #888888;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h2>Solicitud de toures</h2>
    </div>
    <div class="email-body">
      <p>Hola,</p>
      <p>Se ha solicitado una o varias actividades de tour con los siguientes detalles:</p>

      <ul>
        <li><strong>Titular de la reserva:</strong> ${titular}</li>
        <li><strong>Toures solicitados:</strong> ${nombresToures.join(', ')}</li>
        <li><strong>Cantidad de personas:</strong> ${cantidadPersonas}</li>
        <li><strong>Hotel:</strong> ${nombreHotel}</li>
        <li><strong>Número de contacto principal:</strong> ${firstContactNumber}</li>
        <li><strong>Segundo número de contacto:</strong> ${secondContacNumber || 'no incluyó'}</li>
      </ul>

      <p>Por favor, proceder con la validación y confirmación del servicio.</p>

      <p><strong>Ante cualquier duda o inconveniente, contactar a <a href="mailto:reservas@gehsuites.com">reservas@gehsuites.com</a>.</strong></p>

      <p>Gracias,<br>Equipo Geh Suites</p>
    </div>
    <div class="email-footer">
      <p>©${new Date().getFullYear()} Geh Suites. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>

`;
};
