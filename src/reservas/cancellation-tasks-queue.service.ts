import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SendEmailCustomService } from 'src/common/services';
import { AutocoreClient } from 'src/autocore/autocore.client';
import { Reserva } from './entities';
import { ValidPaymentStatus } from './interfaces';
import { ReservasCountCacheService } from './services/reservas-count-cache.service';

type CancellationJobType =
  | 'refund-link'
  | 'cancel-notification-email'
  | 'cancel-tour-transport-email'
  | 'reactivation-expiry';

interface CancellationBaseJob {
  id: string;
  reservaId: string;
  type: CancellationJobType;
  attempt: number;
  maxAttempts: number;
  nextRunAt: number;
  lastError?: string;
  createdAt: number;
}

interface RefundLinkPayload {
  idLink: string;
  agenciaId: number;
  chatbotId: string;
}

interface EmailPayload {
  target: string | string[];
  subject: string;
  html: string;
}

interface ReactivationExpiryPayload {
  nuevaReservaId: string;
  reservaOrigenId: string;
}

type CancellationJob =
  | (CancellationBaseJob & { type: 'refund-link'; payload: RefundLinkPayload })
  | (CancellationBaseJob & {
      type: 'cancel-notification-email' | 'cancel-tour-transport-email';
      payload: EmailPayload;
    })
  | (CancellationBaseJob & {
      type: 'reactivation-expiry';
      payload: ReactivationExpiryPayload;
    });

@Injectable()
export class CancellationTasksQueueService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(CancellationTasksQueueService.name);
  private readonly jobs: CancellationJob[] = [];
  private readonly dedupeKeys = new Map<string, number>();
  private readonly workerIntervalMs = 5000;
  private readonly dedupeTtlMs = 1000 * 60 * 60;
  private workerTimer: NodeJS.Timeout | null = null;
  private processing = false;

  constructor(
    private readonly emailService: SendEmailCustomService,
    private readonly autocoreClient: AutocoreClient,
    @InjectModel(Reserva.name) private readonly reservasModel: Model<Reserva>,
    private readonly countCache: ReservasCountCacheService,
  ) {}

  onModuleInit() {
    // Cola liviana en memoria: válida para despliegues de una sola instancia.
    this.workerTimer = setInterval(() => {
      void this.processDueJobs();
    }, this.workerIntervalMs);
  }

  onModuleDestroy() {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
    }
  }

  enqueueRefundJob(
    reservaId: string,
    payload: RefundLinkPayload,
    maxAttempts = 5,
  ): boolean {
    return this.enqueueJob({
      reservaId,
      type: 'refund-link',
      payload,
      maxAttempts,
    });
  }

  enqueueCancelEmailJob(
    reservaId: string,
    payload: EmailPayload,
    maxAttempts = 4,
  ): boolean {
    return this.enqueueJob({
      reservaId,
      type: 'cancel-notification-email',
      payload,
      maxAttempts,
    });
  }

  enqueueCancelTourTransportEmailJob(
    reservaId: string,
    payload: EmailPayload,
    maxAttempts = 4,
  ): boolean {
    return this.enqueueJob({
      reservaId,
      type: 'cancel-tour-transport-email',
      payload,
      maxAttempts,
    });
  }

  enqueueReactivationExpiryJob(
    reservaId: string,
    payload: ReactivationExpiryPayload,
    runAt: Date,
    maxAttempts = 3,
  ): boolean {
    return this.enqueueJob({
      reservaId,
      type: 'reactivation-expiry',
      payload,
      maxAttempts,
      nextRunAt: runAt.getTime(),
    });
  }

  private enqueueJob(input: {
    reservaId: string;
    type: CancellationJobType;
    payload: RefundLinkPayload | EmailPayload | ReactivationExpiryPayload;
    maxAttempts: number;
    nextRunAt?: number;
  }): boolean {
    this.cleanDedupeCache();
    const dedupeKey = `${input.type}:${input.reservaId}:${JSON.stringify(input.payload)}`;
    const existing = this.dedupeKeys.get(dedupeKey);
    if (existing && Date.now() - existing < this.dedupeTtlMs) {
      return false;
    }

    this.dedupeKeys.set(dedupeKey, Date.now());

    const baseJob = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      reservaId: input.reservaId,
      attempt: 0,
      maxAttempts: input.maxAttempts,
      nextRunAt: input.nextRunAt ?? Date.now(),
      createdAt: Date.now(),
    };

    let job: CancellationJob;
    if (input.type === 'refund-link') {
      job = {
        ...baseJob,
        type: 'refund-link',
        payload: input.payload as RefundLinkPayload,
      };
    } else if (input.type === 'reactivation-expiry') {
      job = {
        ...baseJob,
        type: 'reactivation-expiry',
        payload: input.payload as ReactivationExpiryPayload,
      };
    } else {
      job = {
        ...baseJob,
        type: input.type,
        payload: input.payload as EmailPayload,
      };
    }

    this.jobs.push(job);
    return true;
  }

  private cleanDedupeCache() {
    const now = Date.now();
    for (const [key, timestamp] of this.dedupeKeys.entries()) {
      if (now - timestamp > this.dedupeTtlMs) {
        this.dedupeKeys.delete(key);
      }
    }
  }

  private async processDueJobs() {
    if (this.processing) {
      return;
    }

    this.processing = true;
    try {
      const now = Date.now();
      const dueJobs = this.jobs.filter((job) => job.nextRunAt <= now);
      for (const job of dueJobs) {
        await this.executeJob(job);
      }
    } finally {
      this.processing = false;
    }
  }

  private async executeJob(job: CancellationJob) {
    try {
      job.attempt += 1;

      if (job.type === 'refund-link') {
        await this.autocoreClient.reembolsoCartera(
          job.payload.idLink,
          job.payload.agenciaId,
          job.payload.chatbotId,
        );
      } else if (job.type === 'reactivation-expiry') {
        await this.executeReactivationExpiry(job.payload);
      } else {
        await this.emailService.sendEmail(
          job.payload.target,
          job.payload.subject,
          job.payload.html,
        );
      }

      this.removeJob(job.id);
      this.logger.log(
        `Job de cancelacion completado. type=${job.type} reservaId=${job.reservaId} attempt=${job.attempt}`,
      );
    } catch (error) {
      job.lastError = error instanceof Error ? error.message : String(error);

      if (job.attempt >= job.maxAttempts) {
        this.logger.error(
          `Job de cancelacion agotado. type=${job.type} reservaId=${job.reservaId} attempts=${job.attempt} error=${job.lastError}`,
        );
        this.removeJob(job.id);
        return;
      }

      const backoffMs = Math.min(
        30000 * Math.pow(2, job.attempt - 1),
        1000 * 60 * 30,
      );
      job.nextRunAt = Date.now() + backoffMs;
      this.logger.warn(
        `Reintentando job de cancelacion. type=${job.type} reservaId=${job.reservaId} attempt=${job.attempt} nextRunInMs=${backoffMs}`,
      );
    }
  }

  private async executeReactivationExpiry(payload: ReactivationExpiryPayload) {
    const nueva = await this.reservasModel.findById(payload.nuevaReservaId);

    if (!nueva) {
      await this.liberarReactivacionEnOrigen(payload.reservaOrigenId);
      return;
    }

    if (nueva.status === ValidPaymentStatus.total) {
      this.logger.log(
        `Reactivacion expirada omitida: reserva ${payload.nuevaReservaId} ya tiene pago total`,
      );
      return;
    }

    try {
      await this.autocoreClient.cancelarReservas(nueva.reservaChatbotId);
    } catch (error) {
      this.logger.warn(
        `Error al cancelar reserva reactivada ${nueva.reservaChatbotId} en Autocore: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    await this.reservasModel.findByIdAndDelete(nueva._id);
    this.countCache.invalidateAll();
    await this.liberarReactivacionEnOrigen(payload.reservaOrigenId);

    this.logger.log(
      `Reactivacion expirada procesada. nuevaReservaId=${payload.nuevaReservaId} origenId=${payload.reservaOrigenId}`,
    );
  }

  private async liberarReactivacionEnOrigen(reservaOrigenId: string) {
    await this.reservasModel.updateOne(
      { _id: reservaOrigenId },
      {
        $unset: { reactivacionNuevaReservaId: '' },
        $set: { reactivacionEstado: 'expirada' },
      },
    );
    this.countCache.invalidateAll();
  }

  private removeJob(jobId: string) {
    const index = this.jobs.findIndex((job) => job.id === jobId);
    if (index >= 0) {
      this.jobs.splice(index, 1);
    }
  }
}
