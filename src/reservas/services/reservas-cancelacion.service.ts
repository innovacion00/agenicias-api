import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { AutocoreClient } from 'src/autocore/autocore.client';

import { Agencia } from 'src/agencias/entities';
import { User } from 'src/auth/entities';

import {
  notificacionCancelacionToures,
  notificacionCancelacionVoluntariaReservas,
} from 'src/config';

import { CancelReservaDto, CancelReservaMyToolDto } from '../dto';
import { Reserva } from '../entities';
import {
  obtenerCiudadPorNombre,
  debeBloquearCancelacionPorPrimeraMitadPagada,
} from '../utils';
import { ValidPaymentStatus } from '../interfaces';
import { CancellationTasksQueueService } from '../cancellation-tasks-queue.service';
import { MyToolBookingService } from './my-tool-booking.service';
import { ReservasEmailsService } from './reservas-emails.service';

@Injectable()
export class ReservasCancelacionService {
  private readonly logger = new Logger(ReservasCancelacionService.name);

  constructor(
    @InjectModel(Agencia.name) private readonly agenciaModel: Model<Agencia>,
    @InjectModel(Reserva.name) private readonly reservasModel: Model<Reserva>,
    private readonly autocoreClient: AutocoreClient,
    private readonly cancellationTasksQueueService: CancellationTasksQueueService,
    private readonly myToolBookingService: MyToolBookingService,
    private readonly emailsService: ReservasEmailsService,
  ) {

  }

  async cancelarReserva(cancelReservaDto: CancelReservaDto, user: User) {
    try {
      const reserva = await this.reservasModel.findById(
        cancelReservaDto.reservaId,
      );

      const agenciaDoc = await this.agenciaModel.findById(user.agencia);

      if (!reserva) {
        throw new NotFoundException('Reserva no encontrada');
      }

      if (!agenciaDoc) {
        throw new NotFoundException('Agencia no encontrada');
      }

      if (reserva.status === 4) {
        return {
          msg: `Reserva ${reserva.reservaChatbotId} ya esta cancelada correctamente`,
        };
      }

      if (
        !user.role.includes('admin') &&
        !user.reservas.includes(cancelReservaDto.reservaId) &&
        !user.role.includes('super-admin')
      ) {
        throw new ForbiddenException(
          'No cuentas con los permisos necesarios para cancelar esta reserva',
        );
      }

      if (
        reserva.agenciaId.toString() !== user.agencia.toString() &&
        !user.role.includes('super-admin')
      ) {
        throw new ForbiddenException(
          'No cuentas con los permisos necesarios para cancelar esta reserva',
        );
      }

      if (
        debeBloquearCancelacionPorPrimeraMitadPagada(reserva) &&
        !user.role.includes('super-admin')
      ) {
        await this.emailsService.enviarCorreoSaldoPendienteIntentoCancelacion(
          reserva,
          user.email,
        );
        throw new BadRequestException(
          'No es posible cancelar esta reserva porque ya registra el pago de la primera mitad con saldo pendiente. Se envió un correo con los pasos para gestionar el pago restante.',
        );
      }

      const cancelOpId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const lockedReserva = await this.reservasModel.findOneAndUpdate(
        {
          _id: cancelReservaDto.reservaId,
          status: { $ne: ValidPaymentStatus.cancelado },
          cancelInProgress: { $ne: true },
        },
        {
          $set: {
            cancelInProgress: true,
            cancelRequestedAt: new Date(),
            cancelOpId,
          },
        },
        { new: true },
      );

      if (!lockedReserva) {
        const latest = await this.reservasModel.findById(
          cancelReservaDto.reservaId,
        );
        if (latest?.status === ValidPaymentStatus.cancelado) {
          return {
            msg: `Reserva ${latest.reservaChatbotId} ya esta cancelada correctamente`,
          };
        }

        return {
          msg: 'La cancelacion de la reserva ya esta en proceso, intenta recargar en unos segundos',
        };
      }

      try {
        const autocoreResponse = await this.autocoreClient.cancelarReservas(
          lockedReserva.reservaChatbotId,
        );

        await this.reservasModel.updateOne(
          { _id: lockedReserva._id },
          {
            $set: {
              status: ValidPaymentStatus.cancelado,
              cancelInProgress: false,
              cancelProcessedAt: new Date(),
            },
            $unset: {
              cancelOpId: '',
            },
          },
        );

        lockedReserva.status = ValidPaymentStatus.cancelado;
        this.enqueuePostCancellationTasks(lockedReserva, agenciaDoc);

        if (autocoreResponse?.alreadyCanceled) {
          return {
            msg: `Reserva ${lockedReserva.reservaChatbotId} ya estaba cancelada en Autocore y fue sincronizada localmente`,
          };
        }

        return autocoreResponse;
      } catch (error) {
        await this.reservasModel.updateOne(
          { _id: cancelReservaDto.reservaId },
          {
            $set: { cancelInProgress: false },
            $unset: { cancelOpId: '' },
          },
        );
        throw error;
      }
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  async cancelarReservaAdmin(reservaId: Types.ObjectId) {
    try {
      const reserva = await this.reservasModel.findById(reservaId);

      if (!reserva) {
        throw new NotFoundException('Reserva no encontrada');
      }

      await this.autocoreClient.cancelarReservas(reserva.reservaChatbotId);
      reserva.status = 4;
      await reserva.save();
      return reserva;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  async cancelarReservaMyTool(dto: CancelReservaMyToolDto, user: User) {
    try {
      const reserva = await this.reservasModel.findOne({
        reservaChatbotId: dto.localizador,
      });
      if (!reserva) {
        throw new NotFoundException('Reserva no encontrada');
      }

      const usuarioCancela =
        (dto.usuarioCancela && dto.usuarioCancela.trim()) ||
        user.fullName ||
        user.email;
      const canalVentaParaMyTool =
        dto.canalVentaId ?? reserva.myToolCanalVentaId ?? undefined;

      if (reserva.status === ValidPaymentStatus.cancelado) {
        return { msg: `Reserva ${reserva.reservaChatbotId} ya está cancelada` };
      }

      if (
        !user.role.includes('admin') &&
        !user.role.includes('super-admin') &&
        reserva.agenciaId.toString() !== user.agencia.toString()
      ) {
        throw new ForbiddenException(
          'No cuentas con los permisos necesarios para cancelar esta reserva',
        );
      }

      if (
        debeBloquearCancelacionPorPrimeraMitadPagada(reserva) &&
        !user.role.includes('super-admin')
      ) {
        await this.emailsService.enviarCorreoSaldoPendienteIntentoCancelacion(
          reserva,
          user.email,
        );
        throw new BadRequestException(
          'No es posible cancelar esta reserva porque ya registra el pago de la primera mitad con saldo pendiente. Se envió un correo con los pasos para gestionar el pago restante.',
        );
      }

      if (reserva.reservaProvider === 'mytool') {
        const hotelSlug = this.myToolBookingService.findSlugByHotelName(
          reserva.hotel,
        );
        if (!hotelSlug) {
          throw new BadRequestException(
            `No se encontró configuración MyTool para hotel: ${reserva.hotel}`,
          );
        }

        await this.myToolBookingService.cancelBooking(
          hotelSlug,
          reserva.reservaChatbotId,
          usuarioCancela,
          canalVentaParaMyTool,
          dto.maquinaId,
        );
      } else {
        await this.autocoreClient.cancelarReservas(reserva.reservaChatbotId);
      }

      reserva.status = ValidPaymentStatus.cancelado;
      await reserva.save();

      return {
        msg: `Reserva ${reserva.reservaChatbotId} cancelada correctamente`,
        reserva,
      };
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  private enqueuePostCancellationTasks(
    reserva: Reserva,
    agenciaDoc: Agencia,
  ): void {
    const reservaId = String(reserva._id);

    if (reserva.linksHistory) {
      for (const linkInfo of reserva.linksHistory) {
        if (
          (linkInfo.state === ValidPaymentStatus.mitad ||
            linkInfo.state === ValidPaymentStatus.total) &&
          linkInfo.id
        ) {
          this.cancellationTasksQueueService.enqueueRefundJob(reservaId, {
            idLink: linkInfo.id,
            agenciaId: agenciaDoc.autocoreInfo.id,
            chatbotId: reserva.reservaChatbotId,
          });
        }
      }
    }

    const saldoFavor =
      reserva.status !== ValidPaymentStatus.total
        ? reserva.totalMitad
        : reserva.total;

    const mensajeReserva = notificacionCancelacionVoluntariaReservas(
      reserva.reservaChatbotId,
      agenciaDoc.fullName,
      reserva.pagadoPrimeraMitad,
      saldoFavor,
    );

    this.cancellationTasksQueueService.enqueueCancelEmailJob(reservaId, {
      target: 'reservas@gehsuites.com',
      subject: `Booking connect - Notificacion de cancelacion de reserva por parte de agencia ${agenciaDoc.fullName}`,
      html: mensajeReserva,
    });

    if (reserva.infoToures || reserva.infoTransporte) {
      const mensajeCancelacion = notificacionCancelacionToures(
        `${reserva.titularInfo.firstName} ${reserva.titularInfo.lastName}`,
        reserva.reservation.checkin,
        reserva.reservation.checkout,
        reserva.infoToures?.firstContactNumber ||
          reserva.infoTransporte?.firstContactNumber ||
          '',
      );

      const contactInfo =
        obtenerCiudadPorNombre(reserva.hotel) === 'Santa marta'
          ? 'reservasgocolombia@gmail.com'
          : 'operadortour2025@gmail.com';

      this.cancellationTasksQueueService.enqueueCancelTourTransportEmailJob(
        reservaId,
        {
          target: contactInfo,
          subject:
            'Booking connect - Notificacion de cancelacion de transporte o tour',
          html: mensajeCancelacion,
        },
      );
    }
  }
}
