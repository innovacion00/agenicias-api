import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Recorre recursivamente la respuesta de los endpoints de reservas y, dentro
 * de cada `reservation.roomsData[]`, expone el valor del campo `id` (Autocore)
 * bajo la clave `room_id`.
 *
 * Reglas:
 * - Si el documento ya trae un `room_id` no vacío (típicamente proveniente de
 *   MyTool), se respeta ese valor y el `id` se descarta de la salida.
 * - Si no hay `room_id` válido, se usa el valor de `id`.
 * - Si no hay ninguno de los dos, se expone `room_id: ''`.
 *
 * Es puramente cosmético: no se modifica la BD ni las interfaces internas.
 */
@Injectable()
export class RoomsDataResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next
      .handle()
      .pipe(map((data) => this.transform(data, new WeakSet())));
  }

  private transform(value: unknown, seen: WeakSet<object>): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'object') return value;

    // Si es un documento Mongoose, conviértelo a objeto plano antes de transformar.
    const maybeDoc = value as { toJSON?: () => unknown };
    if (
      typeof maybeDoc.toJSON === 'function' &&
      maybeDoc.toJSON !== Object.prototype.toString
    ) {
      try {
        const plain = maybeDoc.toJSON();
        if (plain !== value) {
          return this.transform(plain, seen);
        }
      } catch {
        // Ignorar errores de serialización y continuar con el objeto tal cual.
      }
    }

    if (seen.has(value as object)) return value;
    seen.add(value as object);

    if (Array.isArray(value)) {
      return value.map((item) => this.transform(item, seen));
    }

    const obj = value as Record<string, unknown>;

    const reservation = obj['reservation'];
    if (
      reservation &&
      typeof reservation === 'object' &&
      !Array.isArray(reservation)
    ) {
      const reservObj = reservation as Record<string, unknown>;
      const rooms = reservObj['roomsData'];
      if (Array.isArray(rooms)) {
        reservObj['roomsData'] = rooms.map((room) => this.renameRoomId(room));
      }
    }

    for (const key of Object.keys(obj)) {
      if (key === 'reservation') continue;
      obj[key] = this.transform(obj[key], seen);
    }

    return obj;
  }

  private renameRoomId(room: unknown): unknown {
    if (!room || typeof room !== 'object') return room;
    const r = room as Record<string, unknown>;

    const existingRoomId =
      typeof r['room_id'] === 'string' ? (r['room_id'] as string).trim() : '';
    const idValue = r['id'];
    const idString =
      idValue === null || idValue === undefined ? '' : String(idValue);

    const finalRoomId = existingRoomId !== '' ? existingRoomId : idString;

    const { id: _omitId, ...rest } = r;
    return { ...rest, room_id: finalRoomId };
  }
}
