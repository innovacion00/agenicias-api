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
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        auth: {
          user: envs.senderEmail,
          pass: envs.emailAppPassword,
        },
      });

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

      return info;
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException(
        'Error en las notificaciones por email',
      );
    }
  }
}
