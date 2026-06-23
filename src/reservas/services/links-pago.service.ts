import { Injectable, InternalServerErrorException } from '@nestjs/common';

import { addMinute } from '@formkit/tempo';

import { Agencia } from 'src/agencias/entities';
import { hotelesAutocorePaymenLink } from 'src/config';

import { AutocoreClient } from 'src/autocore/autocore.client';
import { Reserva } from '../entities';

/**
 * Construcción de links de pago Autocore para reservas.
 *
 * Extraído 1:1 de `ReservasService.buildLinkPagoForReserva` (PR-2.4):
 * cero cambios de comportamiento. Lo usan `ReservasService.generarLinkPago`
 * (Pagos) y `ReservasReactivacionService` (Booking/Reactivación) — ver D3 en
 * docs/planes/fase2-diseno.md.
 */
@Injectable()
export class LinksPagoService {
  constructor(private readonly autocoreClient: AutocoreClient) {}

  async buildLinkPagoForReserva(
    reservaInfo: Reserva,
    agenciaInfo: Agencia,
    pagoTotal: boolean,
    montoOverride?: number,
  ) {
    const hotel = reservaInfo.hotel;
    const external_id = `${reservaInfo._id}${pagoTotal ? ' pagoTotal' : ''}`;

    const linkAutocore = await this.autocoreClient.createLinkPagoAutocore({
      currency: reservaInfo.reservation.currency,
      agency_id: agenciaInfo.autocoreInfo.id,
      amount:
        montoOverride ??
        (pagoTotal ? reservaInfo.total : reservaInfo.totalMitad),
      available_hours: 0.1666,
      booking_dates: `${reservaInfo.reservation.checkin} - ${reservaInfo.reservation.checkout}`,
      description: `Pago para reserva ${reservaInfo.reservaChatbotId} de ${reservaInfo.reservation.nights} noches en ${hotel}`,
      email: agenciaInfo.emailContacto,
      external_ref_id: external_id,
      guest_name: agenciaInfo.fullName,
      hotel_id:
        hotelesAutocorePaymenLink[
          hotel as keyof typeof hotelesAutocorePaymenLink
        ] || 0,
      phone: agenciaInfo.telefonoContacto,
      redirect: {
        failure_url: 'https://agencia.gehsuites.com/misreservas',
        success_url: 'https://agencia.gehsuites.com/misreservas',
      },
      source: 'Booking Connect',
      temp_webhook_url:
        'https://gehsuitesapps.com/agencias/v1/reservas/change-status',
      reservation_id: reservaInfo.reservaChatbotId,
    });

    if (!linkAutocore) {
      throw new InternalServerErrorException('Error al generar link de pago');
    }

    return {
      link: linkAutocore.url,
      expirationDate: addMinute(new Date(), 5),
      idLinkPago: linkAutocore.code,
    };
  }
}
