import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
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
      // const transporter = nodemailer.createTransport({
      //   host: 'smtp.gmail.com',
      //   port: 587,
      //   auth: {
      //     user: envs.senderEmail,
      //     pass: envs.emailAppPassword,
      //   },
      // });

      // const info = await transporter.sendMail({
      //   from: `"Geh Suites No-Reply" <${envs.senderEmail}>`,
      //   to: target,
      //   subject,
      //   text,
      //   html,
      // });
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
