import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { ErrorManager } from 'src/common/helpers';
import { HttpCustomService, SendEmailCustomService } from 'src/common/services';
import { Reserva } from 'src/reservas/entities';
import { selecteroNotificacion } from './utils';

@Injectable()
export class NotificacionesService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    @InjectModel(Reserva.name) private readonly reservaModel: Model<Reserva>,

    private readonly emailService: SendEmailCustomService,

    private readonly httpCustomService: HttpCustomService,
  ) {}

  async notificacionPago() {
    try {
      // const allActiveReservas = await this.reservaModel.find({
      //   status: { $nin: [3, 4] },
      // });

      // for (const reserva of allActiveReservas) {
      //   const res = selecteroNotificacion(
      //     reserva.reservaChatbotId,
      //     reserva.fechaLimitePago,
      //     reserva.reservation.checkin,
      //     reserva.reservation.checkout,
      //   );
      // }
      const { html, vencida, subject } = selecteroNotificacion(
        'CJAKDJK',
        '2025-01-12',
        '2025-01-19',
        '2025-01-20',
      );

      if (!vencida) {
        await this.emailService.sendEmail(
          'innovacion@gehsuites.com',
          subject,
          '',
          html,
        );
      }

      return true;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }
}
