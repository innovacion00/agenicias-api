import { debeBloquearCancelacionPorPrimeraMitadPagada } from './cancelacion-reserva.utils';
import { ValidPaymentStatus } from '../interfaces';

/**
 * Helper puro que decide si se bloquea la cancelación de una reserva
 * cuando ya se registró el pago de la primera mitad (flujo de dinero crítico:
 * un bloqueo mal calculado deja cancelar reservas con plata ya recibida).
 */
describe('debeBloquearCancelacionPorPrimeraMitadPagada', () => {
  describe('cuando la primera mitad está pagada (pagadoPrimeraMitad === true)', () => {
    it('bloquea la cancelación con status "espera" (0)', () => {
      expect(
        debeBloquearCancelacionPorPrimeraMitadPagada({
          pagadoPrimeraMitad: true,
          status: ValidPaymentStatus.espera,
        }),
      ).toBe(true);
    });

    it('bloquea la cancelación con status "mitad" (5)', () => {
      expect(
        debeBloquearCancelacionPorPrimeraMitadPagada({
          pagadoPrimeraMitad: true,
          status: ValidPaymentStatus.mitad,
        }),
      ).toBe(true);
    });

    it('bloquea la cancelación con status "total" (3) — caso documentado en el JSDoc del helper', () => {
      expect(
        debeBloquearCancelacionPorPrimeraMitadPagada({
          pagadoPrimeraMitad: true,
          status: ValidPaymentStatus.total,
        }),
      ).toBe(true);
    });

    it('NO bloquea con status "reservaAbonada" (6): la excepción explícita del negocio', () => {
      expect(
        debeBloquearCancelacionPorPrimeraMitadPagada({
          pagadoPrimeraMitad: true,
          status: ValidPaymentStatus.reservaAbonada,
        }),
      ).toBe(false);
    });

    it('bloquea con status "proceso" (1) y "rejected" (2)', () => {
      expect(
        debeBloquearCancelacionPorPrimeraMitadPagada({
          pagadoPrimeraMitad: true,
          status: ValidPaymentStatus.proceso,
        }),
      ).toBe(true);
      expect(
        debeBloquearCancelacionPorPrimeraMitadPagada({
          pagadoPrimeraMitad: true,
          status: ValidPaymentStatus.rejected,
        }),
      ).toBe(true);
    });

    // BUG?: una reserva ya cancelada (status 4) con pagadoPrimeraMitad=true
    // también devuelve true ("bloquear cancelación"). Hoy es inocuo porque
    // cancelarReservaMyTool corta antes con "ya está cancelada", pero cualquier
    // consumidor nuevo del helper heredaría este resultado contraintuitivo.
    it('devuelve true incluso con status "cancelado" (4) — comportamiento actual', () => {
      expect(
        debeBloquearCancelacionPorPrimeraMitadPagada({
          pagadoPrimeraMitad: true,
          status: ValidPaymentStatus.cancelado,
        }),
      ).toBe(true);
    });
  });

  describe('cuando la primera mitad NO está pagada', () => {
    it('no bloquea con pagadoPrimeraMitad === false (cualquier status no abonado)', () => {
      expect(
        debeBloquearCancelacionPorPrimeraMitadPagada({
          pagadoPrimeraMitad: false,
          status: ValidPaymentStatus.mitad,
        }),
      ).toBe(false);
    });

    it('no bloquea cuando pagadoPrimeraMitad es undefined (reservas viejas sin el campo)', () => {
      expect(
        debeBloquearCancelacionPorPrimeraMitadPagada({
          status: ValidPaymentStatus.total,
        }),
      ).toBe(false);
    });

    it('no bloquea con valores truthy no booleanos (comparación estricta === true)', () => {
      expect(
        debeBloquearCancelacionPorPrimeraMitadPagada({
          // simula un dato sucio en BD: 1 en vez de true
          pagadoPrimeraMitad: 1 as unknown as boolean,
          status: ValidPaymentStatus.mitad,
        }),
      ).toBe(false);
    });
  });
});
