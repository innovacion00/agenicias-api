import { renderTemplate, registerHelpers } from './render.helper';

beforeAll(() => {
  registerHelpers();
});

const FIXED_YEAR = '2026';

describe('Email template snapshots', () => {
  beforeAll(() => {
    jest
      .spyOn(Date.prototype, 'getFullYear')
      .mockReturnValue(Number(FIXED_YEAR));
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('emails-cambio-estado-manual', () => {
    const html = renderTemplate('emails-cambio-estado-manual', {
      reserva: 'RES-001',
      status: 'cancelado',
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-cancelacion-tours', () => {
    const html = renderTemplate('emails-cancelacion-tours', {
      titular: 'Juan Perez',
      fechaCheckin: '2026-07-01',
      fechaCheckout: '2026-07-05',
      numeroTelefono: '+573001234567',
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-cancelacion-vencimiento (sin mitad)', () => {
    const html = renderTemplate('emails-cancelacion-vencimiento', {
      agencia: 'Agencia Test',
      reserva: 'RES-002',
      pagadoPrimeraMitad: false,
      fechaLimitePagoFormateada: '2026-06-15',
      montoFormateado: '$500.000',
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-cancelacion-vencimiento (con mitad)', () => {
    const html = renderTemplate('emails-cancelacion-vencimiento', {
      agencia: 'Agencia Test',
      reserva: 'RES-002',
      pagadoPrimeraMitad: true,
      fechaLimitePagoFormateada: '2026-06-15',
      montoFormateado: '$500.000',
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-cancelacion-voluntaria (sin mitad)', () => {
    const html = renderTemplate('emails-cancelacion-voluntaria', {
      agencia: 'Agencia Test',
      reserva: 'RES-003',
      pagadoPrimeraMitad: false,
      montoFormateado: '$300.000',
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-cancelacion-voluntaria (con mitad)', () => {
    const html = renderTemplate('emails-cancelacion-voluntaria', {
      agencia: 'Agencia Test',
      reserva: 'RES-003',
      pagadoPrimeraMitad: true,
      montoFormateado: '$300.000',
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-confirmacion-reserva', () => {
    const html = renderTemplate('emails-confirmacion-reserva', {
      reserva: 'RES-004',
      checkin: '2026-08-01',
      checkout: '2026-08-05',
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-fallo-pago', () => {
    const html = renderTemplate('emails-fallo-pago', {
      reserva: 'RES-005',
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-grupo', () => {
    const html = renderTemplate('emails-grupo', {
      agencia: 'Agencia Grupo',
      habitacionNum: 5,
      hotel: 'Hotel Plaza',
      checkin: '2026-09-01',
      checkout: '2026-09-05',
      reservaChatbotId: 'GRP-001',
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-pago-vuelo-maarlab (completo)', () => {
    const html = renderTemplate('emails-pago-vuelo-maarlab', {
      agenciaNombre: 'Agencia Vuelos',
      reservaChatbotId: 'VUE-001',
      packageId: 'PKG-123',
      bookingId: 'BKG-456',
      transactionId: 'TXN-789',
      hotel: 'Hotel Mar',
      titularNombre: 'Maria Garcia',
      checkin: '2026-10-01',
      checkout: '2026-10-05',
      origenIata: 'BOG',
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-pago-vuelo-maarlab (campos opcionales ausentes)', () => {
    const html = renderTemplate('emails-pago-vuelo-maarlab', {
      agenciaNombre: 'Agencia Vuelos',
      reservaChatbotId: 'VUE-002',
      packageId: 'PKG-999',
      hotel: 'Hotel Sol',
      checkin: '2026-10-10',
      checkout: '2026-10-15',
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-reactivacion-exitoso', () => {
    const html = renderTemplate('emails-reactivacion-exitoso', {
      reserva: 'RES-006',
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-reactivacion-fallido', () => {
    const html = renderTemplate('emails-reactivacion-fallido', {
      reservaChatbotId: 'RES-007',
      hotel: 'Hotel Centro',
      checkin: '2026-11-01',
      checkout: '2026-11-05',
      montoFormateado: '$1.200.000',
      plazoLimite: '2026-10-28',
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-recordatorio-3d (sin mitad)', () => {
    const html = renderTemplate('emails-recordatorio-3d', {
      reserva: 'RES-008',
      checkin: '2026-07-10',
      checkout: '2026-07-14',
      dias: 3,
      pagadoPrimeraMitad: false,
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-recordatorio-3d (con mitad)', () => {
    const html = renderTemplate('emails-recordatorio-3d', {
      reserva: 'RES-008',
      checkin: '2026-07-10',
      checkout: '2026-07-14',
      dias: 3,
      pagadoPrimeraMitad: true,
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-recordatorio-7d (sin mitad)', () => {
    const html = renderTemplate('emails-recordatorio-7d', {
      reserva: 'RES-009',
      checkin: '2026-07-20',
      checkout: '2026-07-24',
      pagadoPrimeraMitad: false,
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-recordatorio-7d (con mitad)', () => {
    const html = renderTemplate('emails-recordatorio-7d', {
      reserva: 'RES-009',
      checkin: '2026-07-20',
      checkout: '2026-07-24',
      pagadoPrimeraMitad: true,
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-saldo-pendiente', () => {
    const html = renderTemplate('emails-saldo-pendiente', {
      reserva: 'RES-010',
      checkin: '2026-08-15',
      checkout: '2026-08-20',
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-tours', () => {
    const html = renderTemplate('emails-tours', {
      titular: 'Carlos Lopez',
      tourNames: 'City Tour, Playa Tour',
      cantidadPersonas: 4,
      nombreHotel: 'Hotel Caribe',
      firstContactNumber: '+573009876543',
      secondContacNumber: '+573001112233',
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-tours (sin segundo contacto)', () => {
    const html = renderTemplate('emails-tours', {
      titular: 'Carlos Lopez',
      tourNames: 'City Tour',
      cantidadPersonas: 2,
      nombreHotel: 'Hotel Caribe',
      firstContactNumber: '+573009876543',
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-transporte', () => {
    const html = renderTemplate('emails-transporte', {
      titular: 'Ana Martinez',
      firstContactNumber: '+573005554433',
      secondContacNumber: '+573006667788',
      textTipoRecogida: 'Aeropuerto',
      fechaCheckin: '2026-09-10',
      fechaCheckout: '2026-09-15',
      cantidadPersonas: 3,
      aerolinea: 'Avianca',
      numeroVuelo: 'AV1234',
      numeroVueloSalida: 'AV5678',
      contactoAgencia: '+573001234567',
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-transporte (sin opcionales)', () => {
    const html = renderTemplate('emails-transporte', {
      titular: 'Ana Martinez',
      firstContactNumber: '+573005554433',
      textTipoRecogida: 'Hotel',
      fechaCheckin: '2026-09-10',
      fechaCheckout: '2026-09-15',
      cantidadPersonas: 2,
      aerolinea: 'LATAM',
      numeroVuelo: 'LA999',
      contactoAgencia: '+573001234567',
    });
    expect(html).toMatchSnapshot();
  });

  it('emails-ultimo-dia', () => {
    const html = renderTemplate('emails-ultimo-dia', {
      reserva: 'RES-011',
      checkin: '2026-12-01',
      checkout: '2026-12-05',
    });
    expect(html).toMatchSnapshot();
  });
});
