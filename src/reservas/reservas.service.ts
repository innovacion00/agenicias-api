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
      'testnoEXISDSTE@gmail.com',
      'Codigo de verificacion',
      'Hola mundo',
      `
        <!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Código de Verificación</title>
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
        text-align: center;
        color: #555;
        font-size: 16px;
        line-height: 1.6;
      }
      .code {
        font-size: 32px;
        font-weight: bold;
        color: #4caf50;
        letter-spacing: 8px;
        margin: 20px 0;
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
        <h1>Código de Verificación Geh Suites</h1>
      </div>
      <div class="content">
        <div class="code">${num}</div>
        <p>Este código es válido por 10 minutos.</p>
      </div>
      <div class="footer">
        <p>Si no solicitaste este código, puedes ignorar este mensaje.</p>
      </div>
    </div>
  </body>
</html>
        `,
    );

    return { ...info };
  }
}
