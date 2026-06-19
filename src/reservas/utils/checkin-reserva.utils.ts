import { BadRequestException } from '@nestjs/common';

export const MENSAJE_CHECKIN_MISMO_DIA =
  'No se puede crear una reserva del mismo dia';

/** true si checkin (YYYY-MM-DD) cae en el día calendario actual (hora local del servidor). */
export function esCheckinMismoDiaQueHoy(checkin: string): boolean {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const fechaCheckin = new Date(checkin);
  fechaCheckin.setHours(0, 0, 0, 0);

  return fechaCheckin.getTime() === hoy.getTime();
}

export function validarCheckinNoEsMismoDia(checkin: string): void {
  if (esCheckinMismoDiaQueHoy(checkin)) {
    throw new BadRequestException(MENSAJE_CHECKIN_MISMO_DIA);
  }
}
