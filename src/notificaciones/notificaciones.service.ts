import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model, Types } from 'mongoose';

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
      // Optimización: Usar lean() para mejor rendimiento
      const allActiveReservas = await this.reservaModel
        .find({
          status: { $nin: [3, 4] },
        })
        .lean();

      if (!allActiveReservas.length) {
        return true;
      }

      // Filtrar reservas que necesitan notificación
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

      if (!reservasNotification.length) {
        return true;
      }

      // OPTIMIZACIÓN N+1: Obtener todos los userIds únicos
      const userIds = [
        ...new Set(
          reservasNotification
            .map((r) => r.userId)
            .filter((id) => id != null)
            .map((id) => id.toString()),
        ),
      ].map((id) => new Types.ObjectId(id));

      // Una sola query para todos los usuarios con populate
      const users = await this.userModel
        .find({ _id: { $in: userIds } })
        .populate('agencia', 'fullName')
        .lean();

      // Crear mapa para acceso O(1) en lugar de queries N+1
      const usersMap = new Map();
      users.forEach((user) => {
        usersMap.set(user._id.toString(), user);
      });

      let notificaciones = [];

      // Procesar reservas usando el mapa (sin queries adicionales)
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

        // Obtener usuario del mapa (O(1)) en lugar de query individual
        const userDoc = usersMap.get(reserva.userId.toString());

        if (!notiFields.noValid) {
          if (notiFields.vencida) {
            await this.httpCustomService.cancelarReservas(
              reserva.reservaChatbotId,
            );

            // Usar updateOne directo en lugar de save() para mejor rendimiento
            await this.reservaModel.updateOne(
              { _id: reserva._id },
              { $set: { status: 4 } },
            );

            if (!userDoc) {
              continue;
            }

            const agenciaNombre =
              userDoc.agencia &&
              typeof userDoc.agencia === 'object' &&
              'fullName' in userDoc.agencia
                ? (userDoc.agencia.fullName as string)
                : 'Agencia desconocida';

            const mensaje = notificacionCancelacionVencimiento(
              reserva.reservaChatbotId,
              agenciaNombre,
              reserva.pagadoPrimeraMitad,
              fechaLimitePago,
              reserva.totalMitad,
            );

            await this.emailService.sendEmail(
              'reservas@gehsuites.com',
              `Booking connect - Notificacion de cancelacion de reserva para la agencia ${agenciaNombre}`,
              mensaje,
            );
          }

          if (!userDoc) {
            continue;
          }

          if (!notiFields.subject) {
            this.logger.warn('Subject no proporcionado para notificación');
            continue;
          }

          notificaciones.push(
            this.emailService.sendEmail(
              userDoc.email,
              notiFields.subject,
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
