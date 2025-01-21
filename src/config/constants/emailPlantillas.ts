// #region Notificaciones reservas
export const notificacionEmail7Dias = (
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
      <p>se encuentra a <strong>1 semana</strong> de alcanzar la fecha límite de pago.</p>
      <p>Por favor, proceda a realizar el pago cuanto antes para asegurar su reserva. Puede gestionar su reserva directamente haciendo clic en el siguiente enlace:</p>
      <a href="https://agencia.gehsuites.com/misreservas" class="button">Gestionar mi Reserva</a>
      <p>Si tiene alguna duda o necesita asistencia, no dude en ponerse en contacto con nuestro equipo de soporte.</p>
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

export const notificacionEmailMenos3Dias = (
  reserva: string,
  checkin: string,
  checkout: string,
  dias: number,
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
      <p>se encuentra a <strong>${dias} ${dias > 1 ? 'dias' : 'dia'}</strong> de alcanzar la fecha límite de pago.</p>
      <p>Por favor, proceda a realizar el pago cuanto antes para asegurar su reserva. Puede gestionar su reserva directamente haciendo clic en el siguiente enlace:</p>
      <a href="https://agencia.gehsuites.com/misreservas" class="button">Gestionar mi Reserva</a>
      <p>Si tiene alguna duda o necesita asistencia, no dude en ponerse en contacto con nuestro equipo de soporte.</p>
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
      <a href="https://agencia.gehsuites.com/misreservas" class="button">Gestionar mi Reserva</a>
      <p>Si tiene alguna duda o necesita asistencia, no dude en ponerse en contacto con nuestro equipo de soporte.</p>
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
      <p>Si tiene alguna duda o necesita asistencia, no dude en ponerse en contacto con nuestro equipo de soporte.</p>
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
export const notificacionCancelacionVoluntaria = (
  reserva: string,
  agencia: string,
) => {
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
      <p>Les solicitamos realizar las actualizaciones correspondientes en el sistema y, si es necesario, contactar a la agencia para confirmar cualquier detalle adicional.</p>
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
