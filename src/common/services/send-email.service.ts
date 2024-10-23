import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { envs } from 'src/config/envs';

@Injectable()
export class SendEmailCustomService {
  constructor() {}

  private logger = new Logger(SendEmailCustomService.name);

  public async sendEmail(target: string) {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: envs.SENDER_EMAIL,
        pass: envs.EMAIL_APP_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: `"Innovacion geh suites" <${envs.SENDER_EMAIL}>`, // sender address
      to: target, // list of receivers
      subject: 'Hello ✔', // Subject line
      text: 'Hello world?', // plain text body
      html: '<b>Hello world?</b>', // html body
    });
  }
}
