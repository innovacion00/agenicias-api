import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';

import { Model, Types } from 'mongoose';

import { ErrorManager } from 'src/common/helpers';
import { DistributedLockService, SendEmailCustomService } from 'src/common/services';
import { AutocoreClient } from 'src/autocore/autocore.client';
import { Reserva } from 'src/reservas/entities';
import { User } from 'src/auth/entities';
import { selectorNotificacion } from './utils';
import { diffDays } from '@formkit/tempo';
import { notificacionCancelacionVencimiento } from 'src/config';
import { ValidPaymentStatus } from 'src/reservas/interfaces';

@Injectable()
export class NotificacionesService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    @InjectModel(Reserva.name) private readonly reservaModel: Model<Reserva>,
    @InjectModel(User.name) private readonly userModel: Model<User>,

    private readonly emailService: SendEmailCustomService,
    private readonly autocoreClient: AutocoreClient,
    private readonly distributedLock: DistributedLockService,
  ) {
    this.errorManager = new ErrorManager(NotificacionesService.name);
  }

  private getTodayDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async cancelarReservaVencida(
    reserva: Pick<Reserva, '_id' | 'reservaChatbotId'>,
    motivo: 'primer-pago-vencido' | 'segundo-pago-vencido',
  ) {
    try {
      await this.autocoreClient.cancelarReservas(reserva.reservaChatbotId);
    } finally {
      // Sincroniza estado local aunque Autocore responda "already canceled"
      await this.reservaModel.updateOne(
        { _id: reserva._id },
        {
          $set: {
            status: ValidPaymentStatus.cancelado,
            cancelInProgress: false,
            cancelRequestedAt: new Date(),
            cancelProcessedAt: new Date(),
          },
          $unset: { cancelOpId: '' },
        },
      );
      this.logger.warn(
        `Reserva cancelada automaticamente. reservaId=${String(
          reserva._id,
        )} chatbotId=${reserva.reservaChatbotId} motivo=${motivo}`,
      );
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cancelarReservasVencidasAutomatico() {
    await this.distributedLock.tryLock(
      'cron:cancelar-reservas-vencidas',
      () => this.ejecutarCancelacionVencidas(),
      3600000,
    );
  }

  private async ejecutarCancelacionVencidas() {
    try {
      const today = this.getTodayDateString();

      // Caso 1: vencio primera fecha y sigue pendiente de pago (status espera)
      const primerPagoVencido = await this.reservaModel
        .find({
          status: ValidPaymentStatus.espera,
          pagadoPrimeraMitad: false,
          fechaLimitePago: { $lte: today, $exists: true, $ne: null },
          linksHistory: {
            $not: { $elemMatch: { state: ValidPaymentStatus.total } },
          },
        })
        .select('_id reservaChatbotId')
        .lean();

      // Caso 2: vencio segunda fecha y no esta en pago completo
      const segundoPagoVencido = await this.reservaModel
        .find({
          status: {
            $nin: [ValidPaymentStatus.total, ValidPaymentStatus.cancelado],
          },
          pagadoPrimeraMitad: true,
          fechaLimitePago2: { $lte: today, $exists: true, $ne: null },
          linksHistory: {
            $not: { $elemMatch: { state: ValidPaymentStatus.total } },
          },
        })
        .select('_id reservaChatbotId')
        .lean();

      // Evitar duplicados en caso de datos inconsistentes
      const unique = new Map<
        string,
        {
          _id: Types.ObjectId;
          reservaChatbotId: string;
          motivo: 'primer-pago-vencido' | 'segundo-pago-vencido';
        }
      >();
      primerPagoVencido.forEach((r) =>
        unique.set(r._id.toString(), {
          _id: r._id as Types.ObjectId,
          reservaChatbotId: r.reservaChatbotId,
          motivo: 'primer-pago-vencido',
        }),
      );
      segundoPagoVencido.forEach((r) =>
        unique.set(r._id.toString(), {
          _id: r._id as Types.ObjectId,
          reservaChatbotId: r.reservaChatbotId,
          motivo: 'segundo-pago-vencido',
        }),
      );

      if (!unique.size) {
        return;
      }

      for (const reserva of unique.values()) {
        await this.cancelarReservaVencida(reserva, reserva.motivo);
      }
    } catch (error) {
      this.logger.error(
        'Error cancelando reservas vencidas automaticamente',
        error,
      );
      this.errorManager.handle(error);
    }
  }

  async notificacionPago() {
    try {
      // Optimización: Usar lean() para mejor rendimiento
      const allActiveReservas = await this.reservaModel
        .find({
          $or: [
            {
              status: ValidPaymentStatus.espera,
              pagadoPrimeraMitad: false,
              fechaLimitePago: { $exists: true, $ne: null },
              linksHistory: {
                $not: { $elemMatch: { state: ValidPaymentStatus.total } },
              },
            },
            {
              status: ValidPaymentStatus.mitad,
              pagadoPrimeraMitad: true,
              fechaLimitePago2: { $exists: true, $ne: null },
              linksHistory: {
                $not: { $elemMatch: { state: ValidPaymentStatus.total } },
              },
            },
          ],
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
        .populate('agencia', 'fullName emailContacto')
        .lean();

      // Crear mapa para acceso O(1) en lugar de queries N+1
      const usersMap = new Map();
      users.forEach((user) => {
        usersMap.set(user._id.toString(), user);
      });

      const notificaciones: Promise<any>[] = [];

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
            await this.autocoreClient.cancelarReservas(
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
          const destinatarios = new Set<string>();
          if (userDoc.email) {
            destinatarios.add(userDoc.email.trim().toLowerCase());
          }
          if (
            userDoc.agencia &&
            typeof userDoc.agencia === 'object' &&
            'emailContacto' in userDoc.agencia &&
            userDoc.agencia.emailContacto
          ) {
            destinatarios.add(
              String(userDoc.agencia.emailContacto).trim().toLowerCase(),
            );
          }

          const recipients = Array.from(destinatarios);
          if (!recipients.length) {
            this.logger.warn(
              `No hay destinatarios válidos para reserva ${reserva.reservaChatbotId}`,
            );
            continue;
          }

          this.logger.log(
            `Enviando notificación de vencimiento reserva=${reserva.reservaChatbotId} tipo=${notiFields.tipoAviso} destinatarios=${recipients.join(',')}`,
          );

          for (const recipient of recipients) {
            notificaciones.push(
              this.emailService.sendEmail(
                recipient,
                notiFields.subject,
                notiFields.html,
              ),
            );
          }
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
