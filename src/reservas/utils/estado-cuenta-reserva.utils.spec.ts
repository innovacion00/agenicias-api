import {
  decidirMontoReactivacion,
  normalizarMontoPms,
  sumarPagosEstadoCuenta,
} from './estado-cuenta-reserva.utils';

describe('estado-cuenta-reserva.utils', () => {
  describe('normalizarMontoPms', () => {
    it('trunca decimales en cero', () => {
      expect(normalizarMontoPms(187425.0)).toBe(187425);
    });

    it('trunca hacia cero con decimales no cero', () => {
      expect(normalizarMontoPms(187425.99)).toBe(187425);
    });
  });

  describe('sumarPagosEstadoCuenta', () => {
    it('retorna 0 sin result', () => {
      expect(sumarPagosEstadoCuenta({ result: undefined as any })).toBe(0);
    });

    it('suma un pago truncando decimales', () => {
      expect(
        sumarPagosEstadoCuenta({
          result: [
            {
              reservaId: 14986,
              localizador: 'CB47476514',
              pagos: [
                {
                  reservaId: 14986,
                  fecha: '2026-06-06T22:55:40',
                  formaPago: 'Cr. MasterCard',
                  monto: 187425.0,
                },
              ],
            },
          ],
        }),
      ).toBe(187425);
    });

    it('suma pagos de multiples result', () => {
      expect(
        sumarPagosEstadoCuenta({
          result: [
            {
              reservaId: 1,
              localizador: 'CB1',
              pagos: [{ reservaId: 1, fecha: 'x', formaPago: 'x', monto: 100 }],
            },
            {
              reservaId: 2,
              localizador: 'CB2',
              pagos: [
                { reservaId: 2, fecha: 'x', formaPago: 'x', monto: 50.9 },
              ],
            },
          ],
        }),
      ).toBe(150);
    });
  });

  describe('decidirMontoReactivacion', () => {
    const base = { total: 1000000, totalMitad: 500000 };

    it('pagadoPrimeraMitad true -> totalMitad', () => {
      expect(
        decidirMontoReactivacion({
          ...base,
          pagadoPrimeraMitad: true,
          montoPagado: 0,
        }),
      ).toEqual({ accion: 'generar', monto: 500000 });
    });

    it('montoPagado === totalMitad -> totalMitad', () => {
      expect(
        decidirMontoReactivacion({
          ...base,
          pagadoPrimeraMitad: false,
          montoPagado: 500000,
        }),
      ).toEqual({ accion: 'generar', monto: 500000 });
    });

    it('montoPagado === total -> cancelar', () => {
      expect(
        decidirMontoReactivacion({
          ...base,
          pagadoPrimeraMitad: false,
          montoPagado: 1000000,
        }),
      ).toEqual({ accion: 'cancelar' });
    });

    it('abono parcial -> total - montoPagado', () => {
      expect(
        decidirMontoReactivacion({
          ...base,
          pagadoPrimeraMitad: false,
          montoPagado: 200000,
        }),
      ).toEqual({ accion: 'generar', monto: 800000 });
    });

    it('sin pagos -> total', () => {
      expect(
        decidirMontoReactivacion({
          ...base,
          pagadoPrimeraMitad: false,
          montoPagado: 0,
        }),
      ).toEqual({ accion: 'generar', monto: 1000000 });
    });
  });
});
