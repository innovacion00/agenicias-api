import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type PrecioExtraDocument = HydratedDocument<PrecioExtra>;

export enum ConceptoExtra {
  tour = 'tour',
  traslado = 'traslado',
  mascota = 'mascota',
  alimentacion = 'alimentacion',
  impuesto = 'impuesto',
  descuento = 'descuento',
}

export enum UnidadExtra {
  por_persona = 'por_persona',
  por_habitacion = 'por_habitacion',
  por_vehiculo = 'por_vehiculo',
  por_mascota = 'por_mascota',
  porcentaje = 'porcentaje',
}

/**
 * Catálogo central de precios de extras (tours, traslados, mascotas,
 * alimentación, impuestos y descuentos).
 *
 * `hotelId` nulo => aplica de forma global/por ciudad; con valor => overrides
 * específicos del hotel. El rango de vigencia permite versionar cambios de
 * precio sin afectar reservas pasadas (cada reserva guarda su snapshot).
 */
@Schema({ collection: 'precios_extras', timestamps: true })
export class PrecioExtra {
  @Prop({ type: String, enum: Object.values(ConceptoExtra), required: true })
  concepto: ConceptoExtra;

  @Prop({ type: String, required: true, trim: true })
  detalle: string;

  @Prop({ type: Number, default: null })
  hotelId: number | null;

  @Prop({ type: String, uppercase: true, trim: true, default: null })
  ciudad: string | null;

  @Prop({ type: Number, default: null })
  precioCOP: number | null;

  @Prop({ type: Number, default: null })
  precioUSD: number | null;

  @Prop({
    type: String,
    enum: Object.values(UnidadExtra),
    required: true,
  })
  unidad: UnidadExtra;

  /** Para traslados: cuántas personas van por vehículo (cobra el vehículo). */
  @Prop({ type: Number, default: null })
  paxPorVehiculo: number | null;

  /** Para concepto descuento/impuesto: ej. 0.05 (5%) o 19 (IVA). */
  @Prop({ type: Number, default: null })
  porcentaje: number | null;

  @Prop({ type: Date, default: null })
  vigenciaDesde: Date | null;

  @Prop({ type: Date, default: null })
  vigenciaHasta: Date | null;

  @Prop({ type: Boolean, default: true })
  activo: boolean;

  @Prop({ type: Number, default: 0 })
  orden: number;

  /** Meta libre (descripciones, imágenes, etc. de tours) sin romper el esquema. */
  @Prop({ type: MongooseSchema.Types.Mixed, default: undefined })
  informacion?: Record<string, unknown>;
}

export const PrecioExtraSchema = SchemaFactory.createForClass(PrecioExtra);

PrecioExtraSchema.index({ concepto: 1, ciudad: 1, hotelId: 1, orden: 1 });
PrecioExtraSchema.index({ activo: 1, concepto: 1 });