/** Entrada de vuelo MaarLab persistida en Reserva o Cotizacion (mismo shape). */
export interface VueloMaarLabEntry {
  packageId: string;
  respuestaMaarLab: Record<string, any>;
  createdAt: Date;
}
