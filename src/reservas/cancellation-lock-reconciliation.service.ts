import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpCustomService } from 'src/common/services';
import { ValidPaymentStatus } from './interfaces';
import { Reserva } from './entities';
import { debeBloquearCancelacionPorPrimeraMitadPagada } from './utils';

@Injectable()
export class CancellationLockReconciliationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    CancellationLockReconciliationService.name,
  );
  private readonly intervalMs = 1000 * 60 * 5;
  private readonly staleLockMs = 1000 * 60 * 10;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectModel(Reserva.name) private readonly reservaModel: Model<Reserva>,
    private readonly httpCustomService: HttpCustomService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.reconcileStaleCancellationLocks();
    }, this.intervalMs);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async reconcileStaleCancellationLocks() {
    const thresholdDate = new Date(Date.now() - this.staleLockMs);
    const stuckReservations = await this.reservaModel.find({
      cancelInProgress: true,
      status: { $ne: ValidPaymentStatus.cancelado },
      cancelRequestedAt: { $lte: thresholdDate },
    });

    for (const reserva of stuckReservations) {
      await this.reconcileSingleReservation(reserva);
    }
  }

  private async reconcileSingleReservation(reserva: Reserva) {
    try {
      if (debeBloquearCancelacionPorPrimeraMitadPagada(reserva)) {
        await this.reservaModel.updateOne(
          { _id: reserva._id },
          {
            $set: { cancelInProgress: false },
            $unset: { cancelOpId: '' },
          },
        );
        this.logger.warn(
          `Reconciliacion cancelada: reserva ${reserva.reservaChatbotId} tiene primera mitad pagada; no se completa cancelacion en Autocore.`,
        );
        return;
      }

      const cancellationResult = await this.httpCustomService.cancelarReservas(
        reserva.reservaChatbotId,
      );

      if (cancellationResult) {
        await this.reservaModel.updateOne(
          { _id: reserva._id },
          {
            $set: {
              status: ValidPaymentStatus.cancelado,
              cancelInProgress: false,
              cancelProcessedAt: new Date(),
            },
          },
        );
      }
    } catch (error) {
      await this.reservaModel.updateOne(
        { _id: reserva._id },
        {
          $set: {
            cancelInProgress: false,
          },
        },
      );

      this.logger.error(
        `No se pudo reconciliar lock de cancelacion reservaId=${String(
          reserva._id,
        )} chatbotId=${reserva.reservaChatbotId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
