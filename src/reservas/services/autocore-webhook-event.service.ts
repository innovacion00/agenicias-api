import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SendEmailCustomService } from 'src/common/services';
import {
  AutocoreWebhookEvent,
  AutocoreWebhookEventResult,
} from '../entities/autocore-webhook-event.entity';
import {
  AutocoreWebhookPayload,
  AutocoreWebhookProcessOutcome,
  AutocoreWebhookSource,
} from '../interfaces/autocore-webhook-payload.interface';

const WEBHOOK_ALERT_EMAIL = 'reservas@gehsuites.com';

@Injectable()
export class AutocoreWebhookEventService {
  private readonly logger = new Logger(AutocoreWebhookEventService.name);

  constructor(
    @InjectModel(AutocoreWebhookEvent.name)
    private readonly eventModel: Model<AutocoreWebhookEvent>,
    private readonly emailService: SendEmailCustomService,
  ) {}

  async record(
    payload: AutocoreWebhookPayload,
    outcome: AutocoreWebhookProcessOutcome,
    source: AutocoreWebhookSource = 'autocore',
  ): Promise<void> {
    const result = outcome.result ?? 'skipped';

    try {
      await this.eventModel.create({
        result,
        source,
        reservaId: outcome.reservaId ?? null,
        reservaChatbotId: outcome.reservaChatbotId ?? '',
        paymentStatusRaw: payload.payment_status ?? '',
        paymentStatusClass: outcome.paymentStatusClass ?? '',
        externalRefId: payload.external_ref_id ?? '',
        transactionId: payload.transaction_id ?? payload.details?.id ?? '',
        reason: outcome.reason ?? '',
        statusBefore: outcome.statusBefore ?? null,
        statusAfter: outcome.statusAfter ?? null,
        payload: payload as unknown as Record<string, unknown>,
        alertSent: false,
      });
    } catch (error) {
      this.logger.error(
        `[webhook-pago] no se pudo persistir evento: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    if (outcome.shouldAlert) {
      await this.sendAlert(payload, outcome, source);
    }
  }

  async recordError(
    payload: AutocoreWebhookPayload,
    error: unknown,
    source: AutocoreWebhookSource = 'autocore',
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await this.eventModel.create({
        result: 'error',
        source,
        reservaId: null,
        paymentStatusRaw: payload?.payment_status ?? '',
        externalRefId: payload?.external_ref_id ?? '',
        reason: message,
        payload: (payload ?? {}) as unknown as Record<string, unknown>,
        alertSent: true,
      });
    } catch (persistError) {
      this.logger.error(
        `[webhook-pago] no se pudo persistir evento de error: ${
          persistError instanceof Error ? persistError.message : String(persistError)
        }`,
      );
    }

    await this.sendAlert(
      payload,
      {
        result: 'alert',
        reason: message,
        shouldAlert: true,
      },
      source,
    );
  }

  private async sendAlert(
    payload: AutocoreWebhookPayload,
    outcome: AutocoreWebhookProcessOutcome,
    source: AutocoreWebhookSource,
  ): Promise<void> {
    const subject = `[Webhook Autocore] ${outcome.result} — reserva ${outcome.reservaId ?? 'N/A'}`;
    const html = `
      <p><strong>Origen:</strong> ${source}</p>
      <p><strong>Resultado:</strong> ${outcome.result}</p>
      <p><strong>Motivo:</strong> ${outcome.reason ?? 'N/A'}</p>
      <p><strong>Reserva ID:</strong> ${outcome.reservaId ?? 'N/A'}</p>
      <p><strong>Chatbot ID:</strong> ${outcome.reservaChatbotId ?? 'N/A'}</p>
      <p><strong>external_ref_id:</strong> ${payload.external_ref_id ?? ''}</p>
      <p><strong>payment_status:</strong> ${payload.payment_status ?? ''}</p>
      <pre>${JSON.stringify(payload, null, 2)}</pre>
    `;

    this.logger.error(
      `[webhook-pago][ALERTA-EMAIL] ${subject} — ${outcome.reason ?? ''}`,
    );

    try {
      await this.emailService.sendEmail(
        WEBHOOK_ALERT_EMAIL,
        subject,
        html,
      );
    } catch (emailError) {
      this.logger.error(
        `[webhook-pago] fallo envío de alerta: ${
          emailError instanceof Error ? emailError.message : String(emailError)
        }`,
      );
    }
  }
}
