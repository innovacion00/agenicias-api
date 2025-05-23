import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { envs } from 'src/config';

@Injectable()
export class SendEmailCustomService {
  constructor() {}

  private logger = new Logger(SendEmailCustomService.name);
  public async sendEmail(
    target: string | string[],
    subject: string,
    html: string,
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

      const info = await transporter.sendMail({
        from: `"Geh Suites No-Reply" <${envs.senderEmail}>`,
        to: target,
        subject,
        html,
      });

      return info;
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException(
        'Error en las notificaciones por email',
      );
    }
  }
}
