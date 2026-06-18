import { Injectable, Logger } from '@nestjs/common';
import { SendEmailCustomService } from 'src/common/services';
import { notificacionSaldoPendienteIntentoCancelacion } from 'src/config';
import { Reserva } from '../entities';

@Injectable()
export class ReservasEmailsService {
  private readonly logger = new Logger(ReservasEmailsService.name);

  constructor(private readonly emailService: SendEmailCustomService) {}

  async enviarCorreoSaldoPendienteIntentoCancelacion(
    reserva: Reserva,
    recipientEmail: string,
  ): Promise<void> {
    const checkin = reserva.reservation?.checkin ?? '';
    const checkout = reserva.reservation?.checkout ?? '';
    const html = notificacionSaldoPendienteIntentoCancelacion(
      reserva.reservaChatbotId,
      checkin,
      checkout,
    );
    await this.emailService.sendEmail(
      recipientEmail,
      'Booking connect - Saldo pendiente de su reserva',
      html,
    );
  }
}
