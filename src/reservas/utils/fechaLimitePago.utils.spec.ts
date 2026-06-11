import {
  calcularFechaLimitePago,
  AGENCIA_FECHA_LIMITE_3_DIAS_ANTES_CHECKIN,
} from './fechaLimitePago.utils';

/**
 * Helper puro que calcula las fechas límite de pago de una reserva.
 * Es el corazón del flujo de cobros: una fecha mal calculada dispara
 * cancelaciones automáticas o deja reservas sin cobrar.
 *
 * Se congela el reloj a 2026-06-01T00:00:00 (hora local, sin cambios de DST
 * entre junio y agosto en las zonas habituales) para que diffDays/addDay de
 * @formkit/tempo sean deterministas.
 */
describe('calcularFechaLimitePago', () => {
  const HOY = '2026-06-01';

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(2026, 5, 1, 0, 0, 0) });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('regla especial: agencia con fecha límite fija 3 días antes del check-in', () => {
    it('ambas fechas límite son checkin - 3 días, sin importar diasRestantes', () => {
      const res = calcularFechaLimitePago(
        '2026-06-20',
        false,
        AGENCIA_FECHA_LIMITE_3_DIAS_ANTES_CHECKIN,
      );

      expect(res).toEqual({
        fechaLimitePago: '2026-06-17',
        fechaLimitePago2: '2026-06-17',
        diasRestantes: 19,
        diasPrimeraMitad: 3,
        diasSegundaMitad: 1,
        porcentajePrimeraMitad: null,
        porcentajeSegundaMitad: null,
      });
    });

    it('acepta el agenciaId como objeto con toString (ObjectId de Mongo)', () => {
      const res = calcularFechaLimitePago('2026-08-01', true, {
        toString: () => AGENCIA_FECHA_LIMITE_3_DIAS_ANTES_CHECKIN,
      });

      expect(res.fechaLimitePago).toBe('2026-07-29');
      expect(res.fechaLimitePago2).toBe('2026-07-29');
    });

    it('otra agencia NO recibe la regla especial', () => {
      const res = calcularFechaLimitePago(
        '2026-06-20',
        false,
        '000000000000000000000000',
      );
      // cae en la rama 11-30 días: hoy + (19 - 7)
      expect(res.fechaLimitePago).toBe('2026-06-13');
      expect(res.fechaLimitePago2).toBe('2026-06-19');
    });
  });

  describe('reservas con 60 días o más hasta el check-in (pago por porcentajes)', () => {
    it('individual (50% / 60%): fechas = hoy + floor(dias * pct)', () => {
      // checkin a exactamente 60 días
      const res = calcularFechaLimitePago('2026-07-31', false);

      expect(res).toEqual({
        fechaLimitePago: '2026-07-01', // hoy + 30
        fechaLimitePago2: '2026-07-07', // hoy + 36
        diasRestantes: 60,
        diasPrimeraMitad: 30,
        diasSegundaMitad: 36,
        porcentajePrimeraMitad: 50,
        porcentajeSegundaMitad: 60,
      });
    });

    it('reserva de grupo (10% / 30%)', () => {
      const res = calcularFechaLimitePago('2026-07-31', true);

      expect(res).toEqual({
        fechaLimitePago: '2026-06-07', // hoy + floor(60 * 0.1) = +6
        fechaLimitePago2: '2026-06-19', // hoy + floor(60 * 0.3) = +18
        diasRestantes: 60,
        diasPrimeraMitad: 6,
        diasSegundaMitad: 18,
        porcentajePrimeraMitad: 10,
        porcentajeSegundaMitad: 30,
      });
    });

    it('59 días NO entra en la lógica de porcentajes (límite exacto en 60)', () => {
      const res = calcularFechaLimitePago('2026-07-30', false);
      expect(res.porcentajePrimeraMitad).toBeNull();
      // rama 31-59: hoy + (59 - 12)
      expect(res.fechaLimitePago).toBe('2026-07-18');
    });
  });

  describe('reservas cortas (menos de 60 días)', () => {
    it('checkin a 3 días o menos: pago inmediato (hoy)', () => {
      const res = calcularFechaLimitePago('2026-06-04', false); // 3 días
      expect(res.fechaLimitePago).toBe(HOY);
      expect(res.fechaLimitePago2).toBe('2026-06-03'); // checkin - 1
    });

    it('checkin hoy mismo: pago inmediato', () => {
      const res = calcularFechaLimitePago(HOY, false);
      expect(res.diasRestantes).toBe(0);
      expect(res.fechaLimitePago).toBe(HOY);
      // BUG?: fechaLimitePago2 = checkin - 1 queda en el PASADO ('2026-05-31')
      // cuando el check-in es hoy; comportamiento actual documentado.
      expect(res.fechaLimitePago2).toBe('2026-05-31');
    });

    it('checkin entre 4 y 10 días: límite = hoy + (dias - 2)', () => {
      const res = calcularFechaLimitePago('2026-06-06', false); // 5 días
      expect(res.fechaLimitePago).toBe('2026-06-04');
      expect(res.fechaLimitePago2).toBe('2026-06-05');
    });

    it('borde superior de la rama 4-10 (10 días): hoy + 8', () => {
      const res = calcularFechaLimitePago('2026-06-11', false);
      expect(res.fechaLimitePago).toBe('2026-06-09');
    });

    it('checkin entre 11 y 30 días: límite = hoy + (dias - 7)', () => {
      const res = calcularFechaLimitePago('2026-06-21', false); // 20 días
      expect(res.fechaLimitePago).toBe('2026-06-14');
      expect(res.fechaLimitePago2).toBe('2026-06-20');
    });

    it('checkin entre 31 y 59 días: límite = hoy + (dias - 12)', () => {
      const res = calcularFechaLimitePago('2026-07-16', false); // 45 días
      expect(res.fechaLimitePago).toBe('2026-07-04');
      expect(res.fechaLimitePago2).toBe('2026-07-15');
    });

    // BUG?: en TODAS las ramas cortas el retorno fija
    // diasPrimeraMitad = diasRestantes - 12, aunque la fecha calculada haya
    // usado otro offset (-2, -7 o pago inmediato). Para un checkin a 1 día
    // devuelve -11 (valor negativo sin sentido). Documentamos el actual.
    it('diasPrimeraMitad siempre es diasRestantes - 12 en reservas cortas (incluso negativo)', () => {
      const res = calcularFechaLimitePago('2026-06-02', false); // 1 día
      expect(res.diasPrimeraMitad).toBe(-11);
      expect(res.diasSegundaMitad).toBe(1);
      expect(res.porcentajePrimeraMitad).toBeNull();
      expect(res.porcentajeSegundaMitad).toBeNull();
    });
  });
});
