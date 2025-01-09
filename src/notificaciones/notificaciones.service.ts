import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { ErrorManager } from 'src/common/helpers';
import { HttpCustomService, SendEmailCustomService } from 'src/common/services';
import { Reserva } from 'src/reservas/entities';
import { User } from 'src/auth/entities';
import { selecteroNotificacion } from './utils';
import { diffDays } from '@formkit/tempo';

@Injectable()
export class NotificacionesService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    @InjectModel(Reserva.name) private readonly reservaModel: Model<Reserva>,
    @InjectModel(User.name) private readonly userModel: Model<User>,

    private readonly emailService: SendEmailCustomService,
  ) {}

  async notificacionPago() {
    try {
      const allActiveReservas = await this.reservaModel.find({
        status: { $nin: [3, 4] },
      });

      let notificaciones = [];

      for (const reserva of allActiveReservas) {
        await fetch('https://jsonplaceholder.typicode.com/todos/1');
        notificaciones.push(reserva);
        if (diffDays(reserva.fechaLimitePago, new Date()) <= 7) {
          const { html, vencida, subject } = selecteroNotificacion(
            reserva.reservaChatbotId,
            reserva.fechaLimitePago,
            reserva.reservation.checkin,
            reserva.reservation.checkout,
          );

          const userDoc = await this.userModel.findById(reserva.userId);

          if (vencida) {
            await reserva.updateOne({ $set: { status: 4 } });
          }

          await this.emailService.sendEmail(userDoc.email, subject, '', html);
        }
      }
      const results = await Promise.allSettled(notificaciones);
      results.forEach((result) => {
        if (result.status === 'rejected') {
          this.logger.error(result.reason);
        }
      });
      return notificaciones;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }
}
