import { ValidCities } from 'src/common/interface';

export interface IreservaInfo {
  agency: Agency;
  reservation: IreservaInfoBd;
}

export interface Agency {
  is_agency: boolean;
  agency_type: string | number;
  external_ref_id: string;
}

export interface IreservaInfoBd {
  source_of_bussiness: string;
  adults: string;
  checkin: string;
  checkout: string;
  children: string;
  children_ages: string;
  city: ValidCities;
  country: string;
  currency: string;
  email: string;
  firstName: string;
  lastName: string;
  nights: string;
  notes: string;
  rooms: string;
  roomsData: RoomsDatum[];
  telephone: string;
}

export interface RoomsDatum {
  nombreHabitacion: string;
  adults: string;
  children?: string;
  children_ages?: string;
  checkin: string;
  checkout: string;
  currency: string;
  id: string;
  quantity: string;
  rateId: string;
  unitaryPrice: number;
  /** Identificador de habitación (p. ej. MyTool). */
  room_id?: string;
  /** Precio total de hospedaje de la habitación (toda la estancia). */
  precioHabitacion?: number;
  /** Precio de hospedaje por noche de la habitación. */
  precioNocheHabitacion?: number;
  /** Total de tours (una sola vez por reserva). */
  precioToursHabitacion?: number;
  /** Total de traslado (una sola vez por reserva). */
  precioTrasladoHabitacion?: number;
  /** Total de mascotas (una sola vez por reserva). */
  precioMascotasHabitacion?: number;
  /** Número de noches de la habitación. */
  noches?: number;
}
