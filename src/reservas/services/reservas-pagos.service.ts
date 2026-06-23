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
import { AUTOCORE_WEBHOOK_RESERVAS_IGNORADAS } from 'src/config/constants/autocoreWebhookProblemas';
import { Agencia } from 'src/agencias/entities';
import { User } from 'src/auth/entities';
import { Reserva } from '../entities';
import {
  GenerateLinkDto,
  PagoReservaBilleteraDto,
  UpdateFechasPagoDto,
} from '../dto';
import { ValidPaymentStatus, LinksHistory } from '../interfaces';
import { debeBloquearCancelacionPorPrimeraMitadPagada } from '../utils';
import { parseYyyyMmDdOrThrow } from '../utils/fecha.utils';
import { LinksPagoService } from './links-pago.service';
import { ReservasReactivacionService } from './reservas-reactivacion.service';
import { ReservasEmailsService } from './reservas-emails.service';
import { ReservasCountCacheService } from './reservas-count-cache.service';

@Injectable()
export class ReservasPagosService {
  private readonly logger = new Logger(ReservasPagosService.name);

  constructor(
    @InjectModel(Agencia.name) private readonly agenciaModel: Model<Agencia>,
    @InjectModel(Reserva.name) private readonly reservasModel: Model<Reserva>,
    private readonly autocoreClient: AutocoreClient,
    private readonly linksPagoService: LinksPagoService,
    private readonly reactivacionService: ReservasReactivacionService,
    private readonly emailsService: ReservasEmailsService,
    private readonly countCache: ReservasCountCacheService,
  ) {}

  // Sinónimos tolerados de payment_status (normalizados: minúsculas, sin acentos)
  private static readonly STATUS_PENDIENTE = new Set<string>([
    'en proceso',
    'en_proceso',
    'proceso',
    'pendiente',
    'pending',
    'processing',
    'in process',
    'in_process',
  ]);
  private static readonly STATUS_RECHAZADO = new Set<string>([
    'rechazado',
    'rechazada',
    'cancelado',
    'cancelada',
    'tarjeta no valida',
    'rejected',
    'declined',
    'failed',
    'error',
    'canceled',
    'cancelled',
    'denegado',
    'denegada',
  ]);
  private static readonly STATUS_APLICADO = new Set<string>([
    'aplicado',
    'aplicada',
    'aprobado',
    'aprobada',
    'approved',
    'paid',
    'payment_success',
    'success',
    'successful',
    'completed',
    'complete',
    'confirmed',
    'ok',
  ]);

  private normalizarStatusPago(raw: string): string {
    return String(raw || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private clasificarStatusPago(
    normalized: string,
  ): 'PENDIENTE' | 'RECHAZADO' | 'APLICADO' | 'VACIO' | 'DESCONOCIDO' {
    if (!normalized) return 'VACIO';
    if (ReservasPagosService.STATUS_APLICADO.has(normalized)) return 'APLICADO';
    if (ReservasPagosService.STATUS_RECHAZADO.has(normalized))
      return 'RECHAZADO';
    if (ReservasPagosService.STATUS_PENDIENTE.has(normalized))
      return 'PENDIENTE';
    return 'DESCONOCIDO';
  }

  private async logNoOpWebhook(
    reservaId: string,
    clase: string,
    dedupKey: string | null,
  ): Promise<void> {
    const reserva = await this.reservasModel
      .findById(reservaId)
      .select('status paymenIds')
      .lean();
    const yaProcesado = !!dedupKey && !!reserva?.paymenIds?.includes(dedupKey);
    this.logger.log(
      `[webhook-pago] evento ${clase} sin efecto para reserva=${reservaId} ` +
        `(status actual=${reserva?.status ?? 'N/A'}, ` +
        `${yaProcesado ? 'duplicado' : 'transición no permitida / evento tardío'})`,
    );
  }

  private async ejecutarEfectoReactivacion(
    fn: () => Promise<void>,
    reservaId: string,
    tipo: 'exitoso' | 'fallido',
  ): Promise<void> {
    try {
      await fn();
    } catch (error) {
      this.logger.error(
        `[webhook-pago] error en efecto reactivación (${tipo}) reserva=${reservaId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async generarLinkPago(
    generateLinkDto: GenerateLinkDto,
    agencia: Types.ObjectId,
  ) {
    const agenciaInfo = await this.agenciaModel.findById(agencia).exec();
    const reservaInfo = await this.reservasModel.findById(
      generateLinkDto.reservaId,
    );

    if (!reservaInfo || reservaInfo.status === 4 || reservaInfo.status === 3) {
      throw new NotFoundException('Reserva no encontrada');
    }

    if (!agenciaInfo) {
      throw new NotFoundException('Agencia no encontrada');
    }

    const pagoTotal = generateLinkDto.pagoTotal ?? false;
    const linkInfo = await this.linksPagoService.buildLinkPagoForReserva(
      reservaInfo,
      agenciaInfo,
      pagoTotal,
    );

    let updateResult;
    if (pagoTotal) {
      updateResult = await reservaInfo.updateOne({
        $set: { linkInfo, pagadoPrimeraMitad: pagoTotal },
      });
    } else {
      updateResult = await reservaInfo.updateOne({
        $set: { linkInfo },
      });
    }

    if (updateResult.modifiedCount === 0) {
      throw new BadRequestException(
        'No se pudo actualizar la reserva con el link de pago',
      );
    }

    reservaInfo.status = 1;
    await reservaInfo.save();
    this.countCache.invalidateAll();

    return { linkInfo };
  }

  async realizarPagoBilletera(
    pagoReservaBilleteraDto: PagoReservaBilleteraDto,
  ) {
    const data = await this.autocoreClient.pagoBalanceAutocore(
      pagoReservaBilleteraDto.code,
    );
    return data;
  }

  async pagarAutocoreBalanceReserva(
    generateLinkDto: GenerateLinkDto,
    agencia: Types.ObjectId,
  ) {
    const linkDoc = await this.generarLinkPago(generateLinkDto, agencia);

    const pagoBalanceInfo = await this.realizarPagoBilletera({
      code: linkDoc.linkInfo.idLinkPago,
    });

    return pagoBalanceInfo;
  }

  async cambiarEstadoPagoAutocore(payload: {
    external_ref_id: string;
    transaction_id?: string;
    payment_status: string;
    details?: {
      id?: string;
      pay_platform?: string;
    };
  }) {
    const ack = true;
    try {
      if (!payload?.external_ref_id) {
        this.logger.error(
          `[webhook-pago] external_ref_id ausente: ${JSON.stringify(payload)}`,
        );
        return ack;
      }

      const valores = payload.external_ref_id.split(' ');
      const reservaId = valores[0]?.trim();
      const pagoValidator = valores[1]?.trim() || null;

      if (!reservaId) {
        this.logger.error(
          `[webhook-pago] reservaId vacío en external_ref_id: ${JSON.stringify(payload)}`,
        );
        return ack;
      }

      if (!Types.ObjectId.isValid(reservaId)) {
        this.logger.error(
          `[webhook-pago] reservaId inválido "${reservaId}"; evento descartado`,
        );
        return ack;
      }

      if (AUTOCORE_WEBHOOK_RESERVAS_IGNORADAS.includes(reservaId)) {
        this.logger.warn(
          `[webhook-pago] reserva ${reservaId} excluida; evento ignorado`,
        );
        return ack;
      }

      const rawStatus = payload.payment_status;
      const statusNorm = this.normalizarStatusPago(rawStatus);
      const clase = this.clasificarStatusPago(statusNorm);

      const eventId =
        payload.transaction_id?.trim() || payload.details?.id?.trim() || '';
      const dedupKey = eventId ? `${eventId}:${statusNorm}` : null;

      this.logger.log(
        `[webhook-pago] reserva=${reservaId} status="${rawStatus}" clase=${clase} ` +
          `eventId=${eventId || 'N/A'} pagoTotal=${pagoValidator ? 'si' : 'no'}`,
      );

      if (clase === 'VACIO') {
        this.logger.warn(
          `[webhook-pago] payment_status vacío para reserva=${reservaId}; evento ignorado`,
        );
        return ack;
      }

      if (clase === 'DESCONOCIDO') {
        this.logger.error(
          `[webhook-pago][ALERTA] payment_status NO reconocido "${rawStatus}" ` +
            `(norm="${statusNorm}") reserva=${reservaId}. Payload: ${JSON.stringify(payload)}`,
        );
        return ack;
      }

      const existe = await this.reservasModel.exists({ _id: reservaId });
      if (!existe) {
        this.logger.error(
          `[webhook-pago] reserva ${reservaId} no encontrada; evento descartado`,
        );
        return ack;
      }

      const T = ValidPaymentStatus;
      const linkBase = {
        id: payload.details?.id,
        typeOfPayment: payload.details?.pay_platform || 'No identificado',
        fecha: new Date(),
      };
      const dedupFilter = dedupKey ? { paymenIds: { $ne: dedupKey } } : {};
      const dedupUpdate = dedupKey
        ? { $addToSet: { paymenIds: dedupKey } }
        : {};

      if (!dedupKey) {
        this.logger.warn(
          `[webhook-pago] sin transaction_id/details.id: idempotencia no disponible reserva=${reservaId}`,
        );
      }

      // PENDIENTE (en proceso): solo desde espera/proceso; nunca degrada
      if (clase === 'PENDIENTE') {
        const actualizada = await this.reservasModel.findOneAndUpdate(
          {
            _id: reservaId,
            status: { $in: [T.espera, T.proceso] },
            ...dedupFilter,
          },
          { $set: { status: T.espera }, ...dedupUpdate },
          { new: true },
        );
        if (actualizada) {
          this.countCache.invalidateAll();
          this.logger.log(
            `[webhook-pago] reserva=${reservaId} -> espera (en proceso)`,
          );
        } else {
          await this.logNoOpWebhook(reservaId, 'PENDIENTE', dedupKey);
        }
        return ack;
      }

      // RECHAZADO: no sobreescribe mitad/total/cancelado
      if (clase === 'RECHAZADO') {
        const set: Record<string, unknown> = { status: T.rejected };
        if (pagoValidator) {
          set.pagadoPrimeraMitad = false;
        }
        const actualizada = await this.reservasModel.findOneAndUpdate(
          {
            _id: reservaId,
            status: { $nin: [T.total, T.cancelado, T.mitad] },
            ...dedupFilter,
          },
          {
            $set: set,
            $push: { linksHistory: { ...linkBase, state: T.rejected } },
            ...dedupUpdate,
          },
          { new: true },
        );
        if (!actualizada) {
          await this.logNoOpWebhook(reservaId, 'RECHAZADO', dedupKey);
          return ack;
        }
        this.countCache.invalidateAll();
        this.logger.log(`[webhook-pago] reserva=${reservaId} -> rejected`);
        if (actualizada.esReactivacion) {
          await this.ejecutarEfectoReactivacion(
            () =>
              this.reactivacionService.handleReactivacionPagoFallido(
                actualizada,
              ),
            reservaId,
            'fallido',
          );
        }
        return ack;
      }

      // APLICADO: primera mitad → mitad ; segunda → total
      const primeraMitad = await this.reservasModel.findOneAndUpdate(
        {
          _id: reservaId,
          status: { $nin: [T.total, T.cancelado] },
          pagadoPrimeraMitad: false,
          ...dedupFilter,
        },
        {
          $set: { status: T.mitad, pagadoPrimeraMitad: true },
          $push: { linksHistory: { ...linkBase, state: T.mitad } },
          ...dedupUpdate,
        },
        { new: true },
      );
      if (primeraMitad) {
        this.countCache.invalidateAll();
        this.logger.log(
          `[webhook-pago] reserva=${reservaId} -> mitad (primera mitad)`,
        );
        return ack;
      }

      const totalReserva = await this.reservasModel.findOneAndUpdate(
        {
          _id: reservaId,
          status: { $nin: [T.total, T.cancelado] },
          pagadoPrimeraMitad: true,
          ...dedupFilter,
        },
        {
          $set: { status: T.total },
          $push: {
            linksHistory: {
              ...linkBase,
              state: pagoValidator ? T.total : T.mitad,
            },
          },
          ...dedupUpdate,
        },
        { new: true },
      );
      if (totalReserva) {
        this.countCache.invalidateAll();
        this.logger.log(`[webhook-pago] reserva=${reservaId} -> total`);
        if (totalReserva.esReactivacion) {
          await this.ejecutarEfectoReactivacion(
            () =>
              this.reactivacionService.handleReactivacionPagoExitoso(
                totalReserva,
              ),
            reservaId,
            'exitoso',
          );
        }
        return ack;
      }

      await this.logNoOpWebhook(reservaId, 'APLICADO', dedupKey);
      return ack;
    } catch (error) {
      this.logger.error(
        `[webhook-pago] error procesando webhook: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async actualizarStatusReservaManual(
    reservaId: Types.ObjectId | string,
    status: ValidPaymentStatus,
    saltarValidacionCheckin = false,
    forzarCancelacionConPagoMitad = false,
  ) {
    try {
      const _id =
        reservaId instanceof Types.ObjectId
          ? reservaId
          : new Types.ObjectId(String(reservaId));

      const reserva = await this.reservasModel.findById(_id).exec();
      if (!reserva) {
        throw new NotFoundException('Reserva no encontrada');
      }

      if (!saltarValidacionCheckin) {
        const checkinRaw = reserva.reservation?.checkin;
        if (!checkinRaw || typeof checkinRaw !== 'string') {
          throw new BadRequestException(
            'La reserva no tiene check-in válido para validar el cambio de estado',
          );
        }

        const checkinDate = parseYyyyMmDdOrThrow(checkinRaw, 'checkin');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (today >= checkinDate) {
          throw new ForbiddenException(
            'No se puede modificar el estado: la reserva ya llegó a la fecha de check-in. Usa ?saltarValidacionCheckin=true si debes corregir datos como superAdmin.',
          );
        }
      }

      const statusNorm = Number(status);
      if (
        !Number.isInteger(statusNorm) ||
        statusNorm < ValidPaymentStatus.espera ||
        statusNorm > ValidPaymentStatus.reservaAbonada
      ) {
        throw new BadRequestException(
          `status inválido: ${String(status)} (se esperaba entero 0–6)`,
        );
      }

      if (statusNorm === ValidPaymentStatus.cancelado) {
        if (
          !forzarCancelacionConPagoMitad &&
          debeBloquearCancelacionPorPrimeraMitadPagada(reserva)
        ) {
          const destino =
            reserva.reservation?.email?.trim() || 'reservas@gehsuites.com';
          await this.emailsService.enviarCorreoSaldoPendienteIntentoCancelacion(
            reserva,
            destino,
          );
          throw new BadRequestException(
            'No es posible cancelar esta reserva porque ya registra el pago de la primera mitad con saldo pendiente. Se envió un correo con los pasos para gestionar el pago restante. Use forzarCancelacionConPagoMitad=true si debe cancelar de forma excepcional.',
          );
        }
        await this.autocoreClient.cancelarReservas(reserva.reservaChatbotId);
      }

      const pagadoPrimeraMitad =
        statusNorm === ValidPaymentStatus.mitad ||
        statusNorm === ValidPaymentStatus.reservaAbonada ||
        statusNorm === ValidPaymentStatus.total;

      const updateResult = await this.reservasModel.updateOne(
        { _id },
        { $set: { status: statusNorm, pagadoPrimeraMitad } },
      );
      this.countCache.invalidateAll();

      if (updateResult.matchedCount === 0) {
        throw new NotFoundException(
          'Reserva no encontrada al aplicar el cambio de estado',
        );
      }

      this.logger.log(
        `actualizarStatusReservaManual _id=${String(_id)} status=${statusNorm} pagadoPrimeraMitad=${pagadoPrimeraMitad} matched=${updateResult.matchedCount} modified=${updateResult.modifiedCount}`,
      );

      const actualizada = await this.reservasModel.findById(_id).exec();
      if (!actualizada) {
        throw new NotFoundException('Reserva no encontrada tras actualizar');
      }

      return actualizada;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  async actualizarFechasPagoReserva(
    reservaId: Types.ObjectId,
    updateFechasPagoDto: UpdateFechasPagoDto,
    user: User,
  ) {
    const reserva = await this.reservasModel.findById(reservaId).exec();
    if (!reserva) {
      throw new NotFoundException('Reserva no encontrada');
    }
    if (reserva.status === ValidPaymentStatus.cancelado) {
      throw new BadRequestException(
        'No se pueden actualizar fechas de pago en una reserva cancelada',
      );
    }

    const isSuperAdmin = user.role.includes('super-admin');
    if (
      !isSuperAdmin &&
      reserva.agenciaId.toString() !== user.agencia.toString()
    ) {
      throw new ForbiddenException(
        'No cuentas con permisos para modificar las fechas de pago de esta reserva',
      );
    }

    const checkinRaw = reserva.reservation?.checkin;
    if (!checkinRaw || typeof checkinRaw !== 'string') {
      throw new BadRequestException(
        'La reserva no tiene check-in válido para validar las fechas de pago',
      );
    }

    const checkinDate = parseYyyyMmDdOrThrow(checkinRaw, 'checkin');
    const fechaLimitePago = parseYyyyMmDdOrThrow(
      updateFechasPagoDto.fechaLimitePago,
      'fechaLimitePago',
    );
    const fechaLimitePago2 = parseYyyyMmDdOrThrow(
      updateFechasPagoDto.fechaLimitePago2,
      'fechaLimitePago2',
    );

    if (fechaLimitePago > checkinDate) {
      throw new BadRequestException(
        'fechaLimitePago no puede ser mayor a la fecha de check-in de la reserva',
      );
    }
    if (fechaLimitePago2 > checkinDate) {
      throw new BadRequestException(
        'fechaLimitePago2 no puede ser mayor a la fecha de check-in de la reserva',
      );
    }

    reserva.fechaLimitePago = updateFechasPagoDto.fechaLimitePago.trim();
    reserva.fechaLimitePago2 = updateFechasPagoDto.fechaLimitePago2.trim();
    await reserva.save();
    this.countCache.invalidateAll();

    return {
      reservaId: reserva._id,
      reservaChatbotId: reserva.reservaChatbotId,
      fechaLimitePago: reserva.fechaLimitePago,
      fechaLimitePago2: reserva.fechaLimitePago2,
      checkin: reserva.reservation.checkin,
    };
  }
}
