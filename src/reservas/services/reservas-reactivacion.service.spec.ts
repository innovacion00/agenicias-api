/**
 * Tests unitarios de ReservasReactivacionService (PR-2.4).
 *
 * Cobertura mínima requerida por el plan de Fase 2: handleReactivacionPagoExitoso
 * (caso éxito y caso de fallo best-effort en la cancelación de la reserva
 * origen) y handleReactivacionPagoFallido (envío de correo + flag idempotente).
 *
 * Extraído 1:1 de los antiguos métodos privados de ReservasService
 * (handleReactivacionPagoExitoso/handleReactivacionPagoFallido): cero cambios
 * de comportamiento. La diferencia observable es que ahora usan
 * AutocoreClient.cancelarReservas en lugar de HttpCustomService.cancelarReservas
 * (mismo contrato).
 */

// envs valida ~40 variables al importarse (vía src/config); se reemplaza por
// valores dummy, igual que en my-tool-booking.service.spec.ts.
jest.mock('src/config/envs', () => ({
  envs: new Proxy(
    {},
    {
      get: (_target, prop) => (typeof prop === 'string' ? `dummy-${prop}` : ''),
    },
  ),
}));

import { ReservasReactivacionService } from './reservas-reactivacion.service';

function crearReservasModelMock() {
  return {
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({}),
  };
}

function crearService(
  overrides: {
    reservasModel?: any;
    autocoreClient?: any;
    emailService?: any;
  } = {},
) {
  const reservasModel = overrides.reservasModel ?? crearReservasModelMock();
  const agenciaModel = {};
  const userModel = {};
  const autocoreClient = overrides.autocoreClient ?? {
    cancelarReservas: jest.fn().mockResolvedValue({}),
  };
  const emailService = overrides.emailService ?? {
    sendEmail: jest.fn().mockResolvedValue({}),
  };
  const linksPagoService = { buildLinkPagoForReserva: jest.fn() };
  const connection = {};
  const cancellationTasksQueueService = {
    enqueueReactivationExpiryJob: jest.fn(),
  };

  const service = new ReservasReactivacionService(
    agenciaModel as any,
    userModel as any,
    reservasModel as any,
    autocoreClient as any,
    emailService as any,
    linksPagoService as any,
    connection as any,
    cancellationTasksQueueService as any,
  );

  return {
    service,
    reservasModel,
    autocoreClient,
    emailService,
    linksPagoService,
    cancellationTasksQueueService,
  };
}

describe('ReservasReactivacionService.handleReactivacionPagoExitoso', () => {
  it('sin reactivacionDeReservaId: no hace nada', async () => {
    const { service, reservasModel, autocoreClient } = crearService();

    await service.handleReactivacionPagoExitoso({} as any);

    expect(reservasModel.findById).not.toHaveBeenCalled();
    expect(autocoreClient.cancelarReservas).not.toHaveBeenCalled();
    expect(reservasModel.updateOne).not.toHaveBeenCalled();
  });

  it('caso éxito: cancela la reserva origen en Autocore, la elimina y limpia campos de reactivación en la nueva', async () => {
    const reservaOrigen = {
      _id: 'origen-id',
      reservaChatbotId: 'CHAT-ORIGEN',
    };
    const reservasModel = crearReservasModelMock();
    reservasModel.findById.mockResolvedValue(reservaOrigen);

    const { service, autocoreClient } = crearService({ reservasModel });

    const reservaNueva = {
      _id: 'nueva-id',
      reservaChatbotId: 'CHAT-NUEVA',
      reactivacionDeReservaId: 'origen-id',
    };

    await service.handleReactivacionPagoExitoso(reservaNueva as any);

    expect(reservasModel.findById).toHaveBeenCalledWith('origen-id');
    expect(autocoreClient.cancelarReservas).toHaveBeenCalledWith('CHAT-ORIGEN');
    expect(reservasModel.findByIdAndDelete).toHaveBeenCalledWith('origen-id');
    expect(reservasModel.updateOne).toHaveBeenCalledWith(
      { _id: 'nueva-id' },
      {
        $unset: {
          reactivacionExpiraEn: '',
          reactivacionDeReservaId: '',
        },
        $set: { esReactivacion: false },
      },
    );
  });

  it('caso fallo best-effort: si AutocoreClient.cancelarReservas lanza, igual elimina la reserva origen y limpia la nueva', async () => {
    const reservaOrigen = {
      _id: 'origen-id',
      reservaChatbotId: 'CHAT-ORIGEN',
    };
    const reservasModel = crearReservasModelMock();
    reservasModel.findById.mockResolvedValue(reservaOrigen);

    const autocoreClient = {
      cancelarReservas: jest.fn().mockRejectedValue(new Error('boom')),
    };

    const { service } = crearService({ reservasModel, autocoreClient });

    const reservaNueva = {
      _id: 'nueva-id',
      reservaChatbotId: 'CHAT-NUEVA',
      reactivacionDeReservaId: 'origen-id',
    };

    await expect(
      service.handleReactivacionPagoExitoso(reservaNueva as any),
    ).resolves.toBeUndefined();

    expect(autocoreClient.cancelarReservas).toHaveBeenCalledWith('CHAT-ORIGEN');
    // best-effort: el error de Autocore no impide eliminar el origen ni
    // limpiar los campos de reactivación de la nueva reserva.
    expect(reservasModel.findByIdAndDelete).toHaveBeenCalledWith('origen-id');
    expect(reservasModel.updateOne).toHaveBeenCalledWith(
      { _id: 'nueva-id' },
      {
        $unset: {
          reactivacionExpiraEn: '',
          reactivacionDeReservaId: '',
        },
        $set: { esReactivacion: false },
      },
    );
  });

  it('reserva origen no encontrada: no cancela ni elimina, pero limpia la nueva igual', async () => {
    const reservasModel = crearReservasModelMock();
    reservasModel.findById.mockResolvedValue(null);

    const { service, autocoreClient } = crearService({ reservasModel });

    const reservaNueva = {
      _id: 'nueva-id',
      reservaChatbotId: 'CHAT-NUEVA',
      reactivacionDeReservaId: 'origen-id',
    };

    await service.handleReactivacionPagoExitoso(reservaNueva as any);

    expect(autocoreClient.cancelarReservas).not.toHaveBeenCalled();
    expect(reservasModel.findByIdAndDelete).not.toHaveBeenCalled();
    expect(reservasModel.updateOne).toHaveBeenCalledWith(
      { _id: 'nueva-id' },
      expect.objectContaining({ $set: { esReactivacion: false } }),
    );
  });
});

describe('ReservasReactivacionService.handleReactivacionPagoFallido', () => {
  it('si ya se envió el correo (reactivacionCorreoFalloEnviado=true): no reenvía ni actualiza', async () => {
    const { service, emailService, reservasModel } = crearService();

    await service.handleReactivacionPagoFallido({
      reactivacionCorreoFalloEnviado: true,
    } as any);

    expect(emailService.sendEmail).not.toHaveBeenCalled();
    expect(reservasModel.updateOne).not.toHaveBeenCalled();
  });

  it('sin email de huésped: no envía correo ni actualiza', async () => {
    const { service, emailService, reservasModel } = crearService();

    await service.handleReactivacionPagoFallido({
      reactivacionCorreoFalloEnviado: false,
      reservaChatbotId: 'CHAT-NUEVA',
      reservation: { email: '   ' },
    } as any);

    expect(emailService.sendEmail).not.toHaveBeenCalled();
    expect(reservasModel.updateOne).not.toHaveBeenCalled();
  });

  it('con email de huésped: envía el correo de notificación y marca reactivacionCorreoFalloEnviado=true', async () => {
    const { service, emailService, reservasModel } = crearService();

    const reservaNueva = {
      _id: 'nueva-id',
      reactivacionCorreoFalloEnviado: false,
      reservaChatbotId: 'CHAT-NUEVA',
      hotel: 'Hotel Aixo',
      total: 1000,
      reactivacionExpiraEn: new Date('2026-07-01T12:00:00Z'),
      reservation: {
        email: 'huesped@example.com',
        checkin: '2026-07-01',
        checkout: '2026-07-04',
      },
    };

    await service.handleReactivacionPagoFallido(reservaNueva as any);

    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    const [destinatario, asunto] = emailService.sendEmail.mock.calls[0];
    expect(destinatario).toBe('huesped@example.com');
    expect(asunto).toBe('Pago de reactivación de reserva no procesado');

    expect(reservasModel.updateOne).toHaveBeenCalledWith(
      { _id: 'nueva-id' },
      { $set: { reactivacionCorreoFalloEnviado: true } },
    );
  });

  it('si el envío de correo falla, igual marca reactivacionCorreoFalloEnviado=true (no relanza)', async () => {
    const emailService = {
      sendEmail: jest.fn().mockRejectedValue(new Error('smtp down')),
    };
    const { service, reservasModel } = crearService({ emailService });

    const reservaNueva = {
      _id: 'nueva-id',
      reactivacionCorreoFalloEnviado: false,
      reservaChatbotId: 'CHAT-NUEVA',
      hotel: 'Hotel Aixo',
      total: 1000,
      reservation: {
        email: 'huesped@example.com',
        checkin: '2026-07-01',
        checkout: '2026-07-04',
      },
    };

    await expect(
      service.handleReactivacionPagoFallido(reservaNueva as any),
    ).resolves.toBeUndefined();

    expect(reservasModel.updateOne).toHaveBeenCalledWith(
      { _id: 'nueva-id' },
      { $set: { reactivacionCorreoFalloEnviado: true } },
    );
  });
});
