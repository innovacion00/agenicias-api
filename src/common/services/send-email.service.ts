import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { envs } from 'src/config';

interface Attachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

@Injectable()
export class SendEmailCustomService {
  constructor() {}

  private logger = new Logger(SendEmailCustomService.name);
  
  public async sendEmail(
    target: string | string[],
    subject: string,
    html: string,
    attachments?: Attachment[],
  ) {
    try {
      // Validar que las variables de entorno estén configuradas
      if (!envs.senderEmail || !envs.emailAppPassword) {
        this.logger.error('Variables de entorno de email no configuradas');
        throw new InternalServerErrorException(
          'Configuración de email no encontrada. Verifique SENDER_EMAIL y EMAIL_APP_PASSWORD',
        );
      }

      this.logger.log(`Intentando enviar email a: ${Array.isArray(target) ? target.join(', ') : target}`);
      this.logger.log(`Asunto: ${subject}`);

      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // true para 465, false para otros puertos
        auth: {
          user: envs.senderEmail,
          pass: envs.emailAppPassword,
        },
      });

      // Verificar la conexión antes de enviar
      await transporter.verify();
      this.logger.log('Conexión SMTP verificada correctamente');

      const mailOptions: nodemailer.SendMailOptions = {
        from: `"Geh Suites No-Reply" <${envs.senderEmail}>`,
        to: target,
        subject,
        html,
      };

      // Agregar archivos adjuntos si existen
      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments.map(attachment => ({
          filename: attachment.filename,
          content: attachment.content,
          contentType: attachment.contentType,
        }));
      }

      const info = await transporter.sendMail(mailOptions);
      
      this.logger.log(`Email enviado exitosamente. MessageId: ${info.messageId}`);
      this.logger.log(`Respuesta del servidor: ${JSON.stringify(info.response)}`);

      return info;
    } catch (error) {
      this.logger.error('Error al enviar email:', error);
      this.logger.error(`Detalles del error: ${error.message}`);
      if (error.response) {
        this.logger.error(`Respuesta del servidor SMTP: ${error.response}`);
      }
      if (error.code) {
        this.logger.error(`Código de error: ${error.code}`);
      }
      throw new InternalServerErrorException(
        `Error en las notificaciones por email: ${error.message || 'Error desconocido'}`,
      );
    }
  }
}
