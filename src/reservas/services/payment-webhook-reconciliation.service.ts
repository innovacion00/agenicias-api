import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SendEmailCustomService } from 'src/common/services';
import { ValidPaymentStatus } from '../interfaces';
import { Reserva } from '../entities';

const RECONCILE_INTERVAL_MS = 1000 * 60 * 60 * 6; // 6 h
const STALE_LINK_MS = 1000 * 60 * 60 * 24; // 24 h post-expiración
const ALERT_EMAIL = 'reservas@gehsuites.com';

@Injectable()
export class PaymentWebhookReconciliationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PaymentWebhookReconciliationService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectModel(Reserva.name) private readonly reservaModel: Model<Reserva>,
    private readonly emailService: SendEmailCustomService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.reconcileStuckPaymentLinks();
    }, RECONCILE_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Expuesto para pruebas manuales / cron externo. */
  async reconcileStuckPaymentLinks(): Promise<number> {
    const threshold = new Date(Date.now() - STALE_LINK_MS);
    const stuck = await this.reservaModel
      .find({
        status: ValidPaymentStatus.proceso,
        'linkInfo.idLinkPago': { $nin: ['', null] },
        'linkInfo.expirationDate': { $lte: threshold },
      })
      .select(
        'reservaChatbotId linkInfo status pagadoPrimeraMitad createdAt updatedAt',
      )
      .limit(50)
      .lean();

    if (stuck.length === 0) {
      return 0;
    }

    this.logger.warn(
      `[webhook-reconcile] ${stuck.length} reserva(s) en proceso con link expirado >24h`,
    );

    const rows = stuck
      .map(
        (r) =>
          `<li>${r.reservaChatbotId} — link ${r.linkInfo?.idLinkPago} — expiró ${r.linkInfo?.expirationDate}</li>`,
      )
      .join('');

    try {
      await this.emailService.sendEmail(
        ALERT_EMAIL,
        `[Webhook Autocore] ${stuck.length} reserva(s) atascada(s) en proceso`,
        `<p>Las siguientes reservas siguen en <strong>proceso</strong> con link de pago expirado hace más de 24 h. Revisar si Autocore cobró sin webhook o reprocesar manualmente.</p><ul>${rows}</ul>`,
      );
    } catch (error) {
      this.logger.error(
        `[webhook-reconcile] fallo envío email: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return stuck.length;
  }
}
