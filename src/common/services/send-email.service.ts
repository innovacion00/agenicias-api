import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';
import { envs } from 'src/config';

@Injectable()
export class SendEmailCustomService {
  constructor() {}

  private logger = new Logger(SendEmailCustomService.name);
  public async sendEmail(
    target: string,
    subject: string,
    html: string,
  ) {
    try {
      sgMail.setApiKey(envs.sendgridApiKey);

      const msg = {
        to: target, // Change to your recipient
        from: {
          email: envs.senderEmail,
          name: 'Geh Suites No-Reply',
        }, // Change to your verified sender
        subject,
        html,
      };

      await sgMail.send(msg);
      return 'Email enviado';
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException(
        'Error en las notificaciones por email',
      );
    }
  }
}
