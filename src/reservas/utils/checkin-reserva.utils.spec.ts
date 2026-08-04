import {
  esCheckinMismoDiaQueHoy,
  validarCheckinNoEsMismoDia,
  MENSAJE_CHECKIN_MISMO_DIA,
} from './checkin-reserva.utils';
import { BadRequestException } from '@nestjs/common';

describe('checkin-reserva.utils', () => {
  const hoyIso = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  };

  it('detecta checkin del mismo dia', () => {
    expect(esCheckinMismoDiaQueHoy(hoyIso())).toBe(true);
  });

  it('permite checkin de manana', () => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    manana.setHours(0, 0, 0, 0);
    expect(esCheckinMismoDiaQueHoy(manana.toISOString().slice(0, 10))).toBe(
      false,
    );
  });

  it('validarCheckinNoEsMismoDia lanza BadRequestException con mensaje esperado', () => {
    expect(() => validarCheckinNoEsMismoDia(hoyIso())).toThrow(
      BadRequestException,
    );
    expect(() => validarCheckinNoEsMismoDia(hoyIso())).toThrow(
      MENSAJE_CHECKIN_MISMO_DIA,
    );
  });
});
