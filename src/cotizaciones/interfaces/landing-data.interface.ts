export interface LandingData {
  cotizacionId: string;
  hotel: string;
  checkin: string;
  checkout: string;
  noches: number;
  total: number;
  habitaciones: number;
  huéspedes: {
    adultos: number;
    niños: number;
  };
  huésped: {
    nombre: string;
    email: string;
    telefono: string;
  };
  agencia: {
    nombre: string;
    telefono: string;
    email: string;
  };
  fechaLimiteRespuesta: string;
  tokenAcceso: string;
}
