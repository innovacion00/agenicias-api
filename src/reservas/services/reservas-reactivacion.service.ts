import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';

import { addMinute } from '@formkit/tempo';

import { ErrorManager } from 'src/common/helpers';
import { SendEmailCustomService } from 'src/common/services';

import { Agencia } from 'src/agencias/entities';
import { User } from 'src/auth/entities';

import { notificacionReactivacionPagoFallido, tiposAgencia } from 'src/config';

import { AutocoreClient } from 'src/autocore/autocore.client';
import { ReactivarReservaDto } from '../dto';
import { Reserva } from '../entities';
import { calcularFechaLimitePago, obtenerHotelIdPorNombre } from '../utils';
import { ValidPaymentStatus } from '../interfaces';
import { CancellationTasksQueueService } from '../cancellation-tasks-queue.service';
import { LinksPagoService } from './links-pago.service';

/**
 * Reactivación de reservas canceladas y manejo de los desenlaces de pago de
 * la reactivación (éxito/fallo).
 *
 * Extraído de `ReservasService` (PR-2.4) según D3
 * (docs/planes/fase2-diseno.md): aunque `fase2-inventario-reservas.md` ubicaba
 * `reactivarReservaCancelada` en `ReservasBookingService`, D3 (más reciente)
 * lo asigna a este servicio junto con sus colaboradores
 * (`reutilizarReactivacionPendiente`, `buildReservaInfoAutocoreFromReserva`,
 * `handleReactivacionPagoExitoso`, `handleReactivacionPagoFallido`).
 *
 * Lo inyectan: la fachada `ReservasService` (endpoint `reactivar`) y
 * `ReservasService.cambiarEstadoPagoAutocore` (Pagos).
 */
@Injectable()
export class ReservasReactivacionService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(ReservasReactivacionService.name);

  constructor(
    @InjectModel(Agencia.name) private readonly agenciaModel: Model<Agencia>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Reserva.name) private readonly reservasModel: Model<Reserva>,
    private readonly autocoreClient: AutocoreClient,
    private readonly emailService: SendEmailCustomService,
    private readonly linksPagoService: LinksPagoService,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly cancellationTasksQueueService: CancellationTasksQueueService,
  ) {
    this.errorManager = new ErrorManager(ReservasReactivacionService.name);
  }

  // #region Reactivación de reservas canceladas
  async reactivarReservaCancelada(
    reactivarReservaDto: ReactivarReservaDto,
    user: User,
  ) {
    try {
      const { reservaChatbotId } = reactivarReservaDto;
      const reservaOrigen = await this.reservasModel.findOne({
        reservaChatbotId,
      });

      if (!reservaOrigen) {
        throw new NotFoundException('Reserva no encontrada');
      }

      if (reservaOrigen.status !== ValidPaymentStatus.cancelado) {
        throw new BadRequestException(
          'Solo se pueden reactivar reservas canceladas',
        );
      }

      if (reservaOrigen.reservaProvider !== 'autocore') {
        throw new BadRequestException(
          'Solo se pueden reactivar reservas de proveedor Autocore',
        );
      }

      const esSuperAdmin = user.role.includes('super-admin');
      const agenciaOrigenId = reservaOrigen.agenciaId.toString();
      const agenciaUsuarioId = user.agencia?.toString();

      if (!esSuperAdmin && agenciaOrigenId !== agenciaUsuarioId) {
        throw new ForbiddenException(
          'No cuentas con permisos para reactivar reservas de otra agencia',
        );
      }

      const agenciaInfo = await this.agenciaModel.findById(
        reservaOrigen.agenciaId,
      );
      if (!agenciaInfo) {
        throw new NotFoundException('Agencia no encontrada');
      }

      if (reservaOrigen.reactivacionNuevaReservaId) {
        const reutilizada = await this.reutilizarReactivacionPendiente(
          reservaOrigen,
          agenciaInfo,
        );
        if (reutilizada) {
          return reutilizada;
        }
      }

      const hotelId = obtenerHotelIdPorNombre(reservaOrigen.hotel);
      if (!hotelId) {
        throw new BadRequestException(
          `No se pudo mapear el hotel "${reservaOrigen.hotel}" a un hotelId de Autocore`,
        );
      }

      const reservaInfoAutocore = this.buildReservaInfoAutocoreFromReserva(
        reservaOrigen,
        agenciaInfo,
      );

      const reservaAutocoreInfo =
        await this.autocoreClient.createReservaAutocore(
          hotelId,
          reservaInfoAutocore,
        );

      if (!reservaAutocoreInfo) {
        throw new InternalServerErrorException(
          'Error al crear reserva en Autocore',
        );
      }

      if (reservaAutocoreInfo.no_available_rooms) {
        throw new ConflictException({
          code: 'REACTIVACION_SIN_DISPONIBILIDAD',
          message: 'No hay disponibilidad para reactivar esta reserva',
        });
      }

      const isReservaGrupo = reservaOrigen.cantidadHabitaciones >= 10;
      const fechasLimite = calcularFechaLimitePago(
        reservaOrigen.reservation.checkin,
        isReservaGrupo,
        reservaOrigen.agenciaId,
      );

      const reactivacionExpiraEn = addMinute(new Date(), 24 * 60);
      const session = await this.connection.startSession();
      session.startTransaction();

      let nuevaReserva: Reserva;

      try {
        const [created] = await this.reservasModel.create(
          [
            {
              hotel: reservaOrigen.hotel,
              agenciaId: reservaOrigen.agenciaId,
              userId: reservaOrigen.userId,
              cantidadHabitaciones: reservaOrigen.cantidadHabitaciones,
              total: reservaOrigen.total,
              totalMitad: reservaOrigen.totalMitad,
              reservation: reservaOrigen.reservation,
              reservaChatbotId: reservaAutocoreInfo.chatbot_id,
              titularInfo: reservaOrigen.titularInfo,
              fechaLimitePago: fechasLimite.fechaLimitePago,
              fechaLimitePago2: fechasLimite.fechaLimitePago2,
              exentoIva: reservaOrigen.exentoIva,
              reteFuente: reservaOrigen.reteFuente,
              reteIca: reservaOrigen.reteIca,
              reteIva: reservaOrigen.reteIva,
              planAlimentario: reservaOrigen.planAlimentario,
              adicionCena: reservaOrigen.adicionCena,
              adicionAlmuerzo: reservaOrigen.adicionAlmuerzo,
              infoTransporte: reservaOrigen.infoTransporte,
              infoToures: reservaOrigen.infoToures,
              mascotas: reservaOrigen.mascotas,
              mascotasNumber: reservaOrigen.mascotasNumber,
              origenIata: reservaOrigen.origenIata,
              vuelo: reservaOrigen.vuelo,
              reservaProvider: 'autocore',
              esReactivacion: true,
              reactivacionDeReservaId: reservaOrigen._id,
              reactivacionExpiraEn,
            },
          ],
          { session },
        );

        nuevaReserva = created;

        await this.reservasModel.updateOne(
          { _id: reservaOrigen._id },
          {
            $set: {
              reactivacionNuevaReservaId: nuevaReserva._id,
              reactivacionEstado: 'pendiente_pago',
            },
          },
          { session },
        );

        const ownerUser = await this.userModel
          .findById(reservaOrigen.userId)
          .session(session);
        if (
          ownerUser &&
          !ownerUser.reservas.some((id) =>
            id.equals(nuevaReserva._id as Types.ObjectId),
          )
        ) {
          ownerUser.reservas.push(nuevaReserva._id as Types.ObjectId);
          await ownerUser.save({ session });
        }

        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        await session.endSession();
      }

      const linkInfo = await this.linksPagoService.buildLinkPagoForReserva(
        nuevaReserva,
        agenciaInfo,
        true,
      );

      await nuevaReserva.updateOne({
        $set: {
          linkInfo,
          pagadoPrimeraMitad: true,
          status: ValidPaymentStatus.proceso,
        },
      });

      this.cancellationTasksQueueService.enqueueReactivationExpiryJob(
        nuevaReserva._id.toString(),
        {
          nuevaReservaId: nuevaReserva._id.toString(),
          reservaOrigenId: reservaOrigen._id.toString(),
        },
        reactivacionExpiraEn,
      );

      this.logger.log(
        `Reactivacion iniciada: origen=${reservaOrigen.reservaChatbotId} nueva=${nuevaReserva.reservaChatbotId}`,
      );

      return { linkInfo };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  private async reutilizarReactivacionPendiente(
    reservaOrigen: Reserva,
    agenciaInfo: Agencia,
  ): Promise<{
    linkInfo: { link: string; expirationDate: Date; idLinkPago: string };
  } | null> {
    const nuevaPendiente = await this.reservasModel.findById(
      reservaOrigen.reactivacionNuevaReservaId,
    );

    if (!nuevaPendiente) {
      return null;
    }

    const expirada =
      nuevaPendiente.reactivacionExpiraEn &&
      nuevaPendiente.reactivacionExpiraEn <= new Date();

    const pagadaOCancelada =
      nuevaPendiente.status === ValidPaymentStatus.total ||
      nuevaPendiente.status === ValidPaymentStatus.cancelado;

    if (expirada || pagadaOCancelada) {
      return null;
    }

    const linkInfo = await this.linksPagoService.buildLinkPagoForReserva(
      nuevaPendiente,
      agenciaInfo,
      true,
    );

    await nuevaPendiente.updateOne({
      $set: {
        linkInfo,
        pagadoPrimeraMitad: true,
        status: ValidPaymentStatus.proceso,
      },
    });

    this.logger.log(
      `Reactivacion pendiente reutilizada: origen=${reservaOrigen.reservaChatbotId} nueva=${nuevaPendiente.reservaChatbotId}`,
    );

    return { linkInfo };
  }

  private buildReservaInfoAutocoreFromReserva(
    reservaOrigen: Reserva,
    agenciaInfo: Agencia,
  ) {
    const externalRefIdFromAgencia =
      agenciaInfo.cobreInfo?.bolcilloId != null
        ? String(agenciaInfo.cobreInfo.bolcilloId).trim()
        : '';

    const agencyTypeString =
      agenciaInfo.category === 1
        ? tiposAgencia.mayorista
        : tiposAgencia.minorista;

    const reservationData = JSON.parse(
      JSON.stringify(reservaOrigen.reservation),
    );

    return {
      agency: {
        is_agency: true,
        agency_type: agencyTypeString,
        external_ref_id:
          externalRefIdFromAgencia ||
          String(agenciaInfo.autocoreInfo?.id || ''),
      },
      reservation: {
        ...reservationData,
        source_of_bussiness: 'Booking Connect',
      },
    };
  }

  async handleReactivacionPagoExitoso(reservaNueva: Reserva) {
    if (!reservaNueva.reactivacionDeReservaId) {
      return;
    }

    const reservaOrigen = await this.reservasModel.findById(
      reservaNueva.reactivacionDeReservaId,
    );

    if (reservaOrigen) {
      try {
        await this.autocoreClient.cancelarReservas(
          reservaOrigen.reservaChatbotId,
        );
      } catch (error) {
        this.logger.warn(
          `Cancelacion best-effort de reserva origen ${reservaOrigen.reservaChatbotId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      await this.reservasModel.findByIdAndDelete(reservaOrigen._id);
    }

    await this.reservasModel.updateOne(
      { _id: reservaNueva._id },
      {
        $unset: {
          reactivacionExpiraEn: '',
          reactivacionDeReservaId: '',
        },
        $set: { esReactivacion: false },
      },
    );

    this.logger.log(
      `Reactivacion completada: nueva=${reservaNueva.reservaChatbotId} origen eliminada`,
    );
  }

  async handleReactivacionPagoFallido(reservaNueva: Reserva) {
    if (reservaNueva.reactivacionCorreoFalloEnviado) {
      return;
    }

    const guestEmail = reservaNueva.reservation?.email?.trim();
    if (!guestEmail) {
      this.logger.warn(
        `Reactivacion pago fallido sin email de huesped: ${reservaNueva.reservaChatbotId}`,
      );
      return;
    }

    const expiraEn =
      reservaNueva.reactivacionExpiraEn ?? addMinute(new Date(), 24 * 60);

    await this.emailService
      .sendEmail(
        guestEmail,
        'Pago de reactivación de reserva no procesado',
        notificacionReactivacionPagoFallido({
          hotel: reservaNueva.hotel,
          checkin: reservaNueva.reservation.checkin,
          checkout: reservaNueva.reservation.checkout,
          reservaChatbotId: reservaNueva.reservaChatbotId,
          monto: reservaNueva.total,
          expiraEn,
        }),
      )
      .catch((error) => {
        this.logger.error(
          `Error enviando correo de reactivacion fallida: ${error}`,
        );
      });

    await this.reservasModel.updateOne(
      { _id: reservaNueva._id },
      { $set: { reactivacionCorreoFalloEnviado: true } },
    );
  }
  // #endregion Reactivación de reservas canceladas
}
