/**
 * Tests unitarios de LinksPagoService (PR-2.4).
 *
 * Extraído 1:1 de `ReservasService.buildLinkPagoForReserva`: cero cambios de
 * comportamiento. La única diferencia observable es que ahora delega en
 * `AutocoreClient.createLinkPagoAutocore` en lugar de
 * `HttpCustomService.createLinkPagoAutocore` (ambos comparten firma/contrato).
 */
import { InternalServerErrorException } from '@nestjs/common';

// envs valida ~40 variables al importarse (vía src/config/constants/autocoreConstants.ts);
// se reemplaza por valores dummy, igual que en my-tool-booking.service.spec.ts.
jest.mock('src/config/envs', () => ({
  envs: new Proxy(
    {},
    {
      get: (_target, prop) => (typeof prop === 'string' ? `dummy-${prop}` : ''),
    },
  ),
}));

import { LinksPagoService } from './links-pago.service';

function crearAutocoreClientMock() {
  return {
    createLinkPagoAutocore: jest.fn(),
  };
}

function crearReservaInfo(overrides: Record<string, any> = {}) {
  return {
    _id: 'reserva-id-123',
    hotel: 'Hotel Aixo',
    reservaChatbotId: 'CHAT-001',
    total: 1000,
    totalMitad: 500,
    reservation: {
      currency: 'COP',
      checkin: '2026-07-01',
      checkout: '2026-07-04',
      nights: '3',
    },
    ...overrides,
  } as any;
}

function crearAgenciaInfo(overrides: Record<string, any> = {}) {
  return {
    autocoreInfo: { id: 42 },
    emailContacto: 'agencia@example.com',
    fullName: 'Agencia Demo',
    telefonoContacto: '+573000000000',
    ...overrides,
  } as any;
}

describe('LinksPagoService.buildLinkPagoForReserva', () => {
  let autocoreClient: ReturnType<typeof crearAutocoreClientMock>;
  let service: LinksPagoService;

  beforeEach(() => {
    autocoreClient = crearAutocoreClientMock();
    service = new LinksPagoService(autocoreClient as any);
  });

  it('arma el body de Autocore con los datos de la reserva/agencia y pagoTotal=true (sin sufijo " pagoTotal" en logica de monto -> total)', async () => {
    autocoreClient.createLinkPagoAutocore.mockResolvedValue({
      msg: 'ok',
      url: 'https://pagos.autocore.test/abc',
      code: 'CODE-ABC',
    });

    const reservaInfo = crearReservaInfo();
    const agenciaInfo = crearAgenciaInfo();

    const result = await service.buildLinkPagoForReserva(
      reservaInfo,
      agenciaInfo,
      true,
    );

    expect(autocoreClient.createLinkPagoAutocore).toHaveBeenCalledTimes(1);
    const body = autocoreClient.createLinkPagoAutocore.mock.calls[0][0];

    expect(body.currency).toBe('COP');
    expect(body.agency_id).toBe(42);
    expect(body.amount).toBe(1000); // pagoTotal=true -> total
    expect(body.available_hours).toBe(0.1666);
    expect(body.booking_dates).toBe('2026-07-01 - 2026-07-04');
    expect(body.description).toBe(
      'Pago para reserva CHAT-001 de 3 noches en Hotel Aixo',
    );
    expect(body.email).toBe('agencia@example.com');
    expect(body.external_ref_id).toBe('reserva-id-123 pagoTotal');
    expect(body.guest_name).toBe('Agencia Demo');
    expect(body.hotel_id).toBe(4); // hotelesAutocorePaymenLink['Hotel Aixo']
    expect(body.phone).toBe('+573000000000');
    expect(body.redirect).toEqual({
      failure_url: 'https://agencia.gehsuites.com/misreservas',
      success_url: 'https://agencia.gehsuites.com/misreservas',
    });
    expect(body.source).toBe('Booking Connect');
    expect(body.temp_webhook_url).toBe(
      'https://gehsuitesapps.com/agencias/v1/reservas/change-status',
    );
    expect(body.reservation_id).toBe('CHAT-001');

    expect(result).toEqual({
      link: 'https://pagos.autocore.test/abc',
      expirationDate: expect.any(Date),
      idLinkPago: 'CODE-ABC',
    });
  });

  it('pagoTotal=false usa totalMitad como amount y external_ref_id sin sufijo', async () => {
    autocoreClient.createLinkPagoAutocore.mockResolvedValue({
      msg: 'ok',
      url: 'https://pagos.autocore.test/xyz',
      code: 'CODE-XYZ',
    });

    const reservaInfo = crearReservaInfo();
    const agenciaInfo = crearAgenciaInfo();

    await service.buildLinkPagoForReserva(reservaInfo, agenciaInfo, false);

    const body = autocoreClient.createLinkPagoAutocore.mock.calls[0][0];
    expect(body.amount).toBe(500); // totalMitad
    expect(body.external_ref_id).toBe('reserva-id-123');
  });

  it('hotel sin mapeo en hotelesAutocorePaymenLink usa hotel_id=0', async () => {
    autocoreClient.createLinkPagoAutocore.mockResolvedValue({
      msg: 'ok',
      url: 'https://pagos.autocore.test/abc',
      code: 'CODE-ABC',
    });

    const reservaInfo = crearReservaInfo({ hotel: 'Hotel Inexistente' });
    const agenciaInfo = crearAgenciaInfo();

    await service.buildLinkPagoForReserva(reservaInfo, agenciaInfo, true);

    const body = autocoreClient.createLinkPagoAutocore.mock.calls[0][0];
    expect(body.hotel_id).toBe(0);
  });

  it('si AutocoreClient no retorna data, lanza InternalServerErrorException', async () => {
    autocoreClient.createLinkPagoAutocore.mockResolvedValue(undefined);

    const reservaInfo = crearReservaInfo();
    const agenciaInfo = crearAgenciaInfo();

    await expect(
      service.buildLinkPagoForReserva(reservaInfo, agenciaInfo, true),
    ).rejects.toThrow(
      new InternalServerErrorException('Error al generar link de pago'),
    );
  });
});
