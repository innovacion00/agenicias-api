import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { ErrorManager } from 'src/common/helpers';
import { HttpCustomService, SendEmailCustomService } from 'src/common/services';
import { Reserva } from 'src/reservas/entities';
import { User } from 'src/auth/entities';
import { selectorNotificacion } from './utils';
import { diffDays } from '@formkit/tempo';
import { notificacionCancelacionVencimiento } from 'src/config';

@Injectable()
export class NotificacionesService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    @InjectModel(Reserva.name) private readonly reservaModel: Model<Reserva>,
    @InjectModel(User.name) private readonly userModel: Model<User>,

    private readonly emailService: SendEmailCustomService,
    private readonly httpCustomService: HttpCustomService,
  ) {}

  async notificacionPago() {
    try {
      const allActiveReservas = await this.reservaModel.find({
        status: { $nin: [3, 4] },
      });
      if (!allActiveReservas.length) {
        return true;
      }
      let notificaciones = [];

      const reservasNotification = allActiveReservas.filter((reserva) => {
        if (
          diffDays(reserva.fechaLimitePago, new Date()) <= 7 &&
          !reserva.pagadoPrimeraMitad
        ) {
          return reserva;
        }

        if (
          diffDays(reserva.fechaLimitePago2, new Date()) <= 7 &&
          reserva.pagadoPrimeraMitad
        ) {
          return reserva;
        }
      });

      for (const reserva of reservasNotification) {
        const fechaLimitePago = !reserva.pagadoPrimeraMitad
          ? reserva.fechaLimitePago
          : reserva.fechaLimitePago2;

        const notiFields = selectorNotificacion(
          reserva.reservaChatbotId,
          fechaLimitePago,
          reserva.pagadoPrimeraMitad,
          reserva.reservation.checkin,
          reserva.reservation.checkout,
        );

        const userDoc = await this.userModel
          .findById(reserva.userId)
          .lean()
          .populate('agencia', 'fullName');

        if (!notiFields.noValid) {
          if (notiFields.vencida) {
            await this.httpCustomService.cancelarReservas(
              reserva.reservaChatbotId,
            );

            await reserva.updateOne({ $set: { status: 4 } });

            const mensaje = notificacionCancelacionVencimiento(
              reserva.reservaChatbotId,
              // @ts-ignore
              userDoc.agencia.fullName,
              reserva.pagadoPrimeraMitad,
              fechaLimitePago,
              reserva.totalMitad,
            );
            await this.emailService.sendEmail(
              'reservas@gehsuites.com',
              // @ts-ignore
              `Booking connect - Notificacion de cancelacion de reserva para la agencia ${userDoc.agencia.fullName}`,
              '',
              mensaje,
            );
          }

          notificaciones.push(
            this.emailService.sendEmail(
              userDoc.email,
              notiFields.subject,
              '',
              notiFields.html,
            ),
          );
        }
      }
      const results = await Promise.allSettled(notificaciones);
      results.forEach((result) => {
        if (result.status === 'rejected') {
          this.logger.error(result.reason);
        }
      });
      return true;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }
}
