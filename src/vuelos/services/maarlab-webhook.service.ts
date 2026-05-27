import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Reserva } from 'src/reservas/entities';
import { Agencia } from 'src/agencias/entities';
import { User } from 'src/auth/entities';
import { SendEmailCustomService } from 'src/common/services';
import { notificacionPagoVueloMaarlab } from 'src/config/constants/emailPlantillas';

export type MaarlabWebhookEventType =
  | 'booking'
  | 'payment'
  | 'canceled'
  | 'contracting';

const PAYMENT_SUCCESS = new Set([
  'paid',
  'payment_success',
  'success',
  'successful',
  'completed',
  'complete',
  'aplicado',
  'confirmed',
  'ok',
  'true',
  '1',
]);

const PAYMENT_FAILED = new Set([
  'failed',
  'rejected',
  'rechazado',
  'cancelado',
  'canceled',
  'cancelled',
  'error',
  'declined',
]);

@Injectable()
export class MaarlabWebhookService {
  private readonly logger = new Logger(MaarlabWebhookService.name);

  constructor(
    @InjectModel(Reserva.name) private readonly reservasModel: Model<Reserva>,
    @InjectModel(Agencia.name) private readonly agenciaModel: Model<Agencia>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly emailService: SendEmailCustomService,
  ) {}

  async handleWebhook(
    eventType: MaarlabWebhookEventType,
    payload: Record<string, unknown>,
  ): Promise<{ success: boolean; message?: string }> {
    this.logger.log(`Webhook MaarLab [${eventType}]`, payload);

    const packageId = this.extractPackageId(payload);
    if (!packageId) {
      this.logger.warn(`Webhook ${eventType} sin package_id`);
      return { success: false, message: 'package_id requerido' };
    }

    const reserva = await this.reservasModel.findOne({
      'vuelo.packageId': packageId,
    });

    if (!reserva) {
      this.logger.warn(
        `Reserva no encontrada para packageId=${packageId} (webhook ${eventType})`,
      );
      return { success: false, message: 'Reserva no encontrada' };
    }

    const vueloIdx = reserva.vuelo.findIndex((v) => v.packageId === packageId);
    if (vueloIdx < 0) {
      return {
        success: false,
        message: 'Paquete de vuelo no encontrado en reserva',
      };
    }

    const entry = reserva.vuelo[vueloIdx];
    entry.lastWebhookType = eventType;
    entry.respuestaMaarLab = {
      ...entry.respuestaMaarLab,
      [`webhook_${eventType}`]: {
        receivedAt: new Date().toISOString(),
        payload,
      },
    };

    if (eventType === 'booking') {
      entry.bookingStatus =
        this.extractStatus(payload) || entry.bookingStatus || 'notified';
    }

    if (eventType === 'canceled') {
      entry.paymentStatus = 'canceled';
      entry.paymentUpdatedAt = new Date();
      entry.bookingStatus = 'canceled';
    }

    if (eventType === 'payment') {
      const statusRaw = this.extractStatus(payload);
      // MaarLab suele llamar payment_url solo al confirmar pago (sin status en query).
      const normalized = (statusRaw || 'paid').toLowerCase().trim();
      const isSuccess = PAYMENT_SUCCESS.has(normalized);
      const isFailed = PAYMENT_FAILED.has(normalized);

      if (isSuccess) {
        entry.paymentStatus = 'paid';
        entry.paymentUpdatedAt = new Date();
        await reserva.save();
        await this.notifyAgenciaPagoVuelo(reserva, entry.packageId, payload);
        return { success: true, message: 'Pago de vuelo registrado' };
      }

      if (isFailed) {
        entry.paymentStatus = normalized.includes('cancel')
          ? 'canceled'
          : 'failed';
        entry.paymentUpdatedAt = new Date();
        await reserva.save();
        return {
          success: true,
          message: `Pago de vuelo: ${entry.paymentStatus}`,
        };
      }

      entry.paymentStatus = normalized || 'pending';
      entry.paymentUpdatedAt = new Date();
      await reserva.save();
      return {
        success: true,
        message: 'Estado de pago actualizado (pendiente)',
      };
    }

    await reserva.save();
    return { success: true, message: `Webhook ${eventType} procesado` };
  }

  private async notifyAgenciaPagoVuelo(
    reserva: Reserva,
    packageId: string,
    webhookPayload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const agencia = await this.agenciaModel.findById(reserva.agenciaId);
      const user = await this.userModel.findById(reserva.userId);

      const destinatarios = new Set<string>();
      if (agencia?.emailContacto) {
        destinatarios.add(agencia.emailContacto.trim().toLowerCase());
      }
      if (user?.email) {
        destinatarios.add(user.email.trim().toLowerCase());
      }

      if (!destinatarios.size) {
        this.logger.warn(
          `Sin email para notificar pago vuelo reserva=${reserva.reservaChatbotId}`,
        );
        return;
      }

      const titular = reserva.titularInfo;
      const reservation = reserva.reservation;
      const vueloEntry = reserva.vuelo.find((v) => v.packageId === packageId);
      const respuesta = vueloEntry?.respuestaMaarLab ?? {};

      const html = notificacionPagoVueloMaarlab({
        agenciaNombre: agencia?.fullName ?? 'Agencia',
        reservaChatbotId: reserva.reservaChatbotId,
        packageId,
        hotel: reserva.hotel,
        titularNombre:
          `${titular?.firstName ?? ''} ${titular?.lastName ?? ''}`.trim(),
        checkin: reservation?.checkin ?? '',
        checkout: reservation?.checkout ?? '',
        origenIata: reserva.origenIata ?? '',
        transactionId: this.extractTransactionId(webhookPayload),
        bookingId: this.extractBookingId(respuesta, webhookPayload),
      });

      const subject = `Booking Connect — Pago de vuelo confirmado (${reserva.reservaChatbotId})`;

      for (const to of destinatarios) {
        await this.emailService.sendEmail(to, subject, html);
      }

      this.logger.log(
        `Email pago vuelo enviado reserva=${reserva.reservaChatbotId} → ${[...destinatarios].join(', ')}`,
      );
    } catch (error) {
      this.logger.error(
        `Error enviando email pago vuelo reserva=${reserva.reservaChatbotId}`,
        error,
      );
    }
  }

  private extractPackageId(payload: Record<string, unknown>): string | null {
    const keys = ['package_id', 'packageId', 'package-id', 'id_package'];
    for (const key of keys) {
      const v = payload[key];
      if (typeof v === 'string' && v.trim()) {
        return v.trim();
      }
    }
    return null;
  }

  private extractStatus(payload: Record<string, unknown>): string {
    const keys = [
      'payment_status',
      'paymentStatus',
      'status',
      'state',
      'payment_state',
    ];
    for (const key of keys) {
      const v = payload[key];
      if (typeof v === 'string' && v.trim()) {
        return v.trim();
      }
      if (typeof v === 'boolean') {
        return v ? 'paid' : 'failed';
      }
    }
    return '';
  }

  private extractTransactionId(payload: Record<string, unknown>): string {
    const keys = ['transaction_id', 'transactionId', 'payment_id', 'paymentId'];
    for (const key of keys) {
      const v = payload[key];
      if (typeof v === 'string' && v.trim()) {
        return v.trim();
      }
    }
    return '';
  }

  private extractBookingId(
    respuesta: Record<string, any>,
    payload: Record<string, unknown>,
  ): string {
    const fromPayload = payload.booking_id ?? payload.bookingId;
    if (typeof fromPayload === 'string' && fromPayload.trim()) {
      return fromPayload.trim();
    }
    const fromResp =
      respuesta.bookingId ??
      respuesta.booking_id ??
      respuesta.localizador ??
      respuesta.locator;
    if (typeof fromResp === 'string' && fromResp.trim()) {
      return fromResp.trim();
    }
    return '';
  }
}
