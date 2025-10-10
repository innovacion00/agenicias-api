export interface CotizacionResponse {
  id: string;
  status: number;
  hotel: string;
  total: number;
  checkin: string;
  checkout: string;
  landingUrl: string;
  pdfUrl?: string;
  fechaCreacion: Date;
  fechaLimiteRespuesta: string;
  agencia: {
    id: string;
    nombre: string;
  };
  huésped: {
    nombre: string;
    email: string;
    telefono: string;
  };
}
