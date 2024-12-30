import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { envs } from 'src/config/envs';

@Injectable()
export class SendEmailCustomService {
  constructor() {}

  private logger = new Logger(SendEmailCustomService.name);
  public async sendEmail(
    target: string,
    subject: string,
    text: string,
    html: string,
  ) {
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
      text,
      html,
    });

    return info;
  }
}
