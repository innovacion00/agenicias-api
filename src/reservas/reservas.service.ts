import { Injectable } from '@nestjs/common';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { UpdateReservaDto } from './dto/update-reserva.dto';
import { SendEmailCustomService } from 'src/common/services';

@Injectable()
export class ReservasService {
  constructor(
    private readonly sendEmailCustomService: SendEmailCustomService,
  ) {}

  create(createReservaDto: CreateReservaDto) {
    return 'This action adds a new reserva';
  }

  async prueba() {
    const num = 12345;
    const info = await this.sendEmailCustomService.sendEmail(
      'sebastiandevmm@gmail.com',
      'Codigo de verificacion',
      'Hola mundo',
      `
       <!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bienvenido a [Nombre de la Plataforma]</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f4f4f4;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 20px auto;
        background-color: #ffffff;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      .header {
        text-align: center;
        padding-bottom: 20px;
      }
      .header h1 {
        color: #333;
        margin: 0;
        font-size: 24px;
      }
      .content {
        text-align: left;
        color: #555;
        font-size: 16px;
        line-height: 1.6;
      }
      .cta {
        text-align: center;
        margin: 30px 0;
      }
      .cta a {
        background-color: #4caf50;
        color: #ffffff;
        padding: 12px 24px;
        text-decoration: none;
        font-size: 16px;
        font-weight: bold;
        border-radius: 5px;
      }
      .cta a:hover {
        background-color: #45a049;
      }
      .footer {
        text-align: center;
        color: #999;
        font-size: 12px;
        padding-top: 20px;
        border-top: 1px solid #ddd;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>¡Bienvenido a [Nombre de la Plataforma]!</h1>
      </div>
      <div class="content">
        <p>¡Hola [Nombre del Usuario]!</p>
        <p>Nos alegra darte la bienvenida a nuestra plataforma. Has tomado el primer paso hacia una experiencia increíble y estamos aquí para ayudarte a sacar el máximo provecho.</p>
        <p>Para empezar, nos gustaría ofrecerte un tutorial asistido. Puedes agendar una cita en el horario que más te convenga para explorar todas las funcionalidades y beneficios de la plataforma.</p>
      </div>
      <div class="cta">
        <a href="[Enlace para Agendar Cita]" target="_blank">Agendar Tutorial</a>
      </div>
      <div class="footer">
        <p>Gracias por unirte a nosotros,</p>
        <p>El equipo de [Nombre de la Plataforma]</p>
      </div>
    </div>
  </body>
</html>  `,
    );

    return { ...info };
  }
}
