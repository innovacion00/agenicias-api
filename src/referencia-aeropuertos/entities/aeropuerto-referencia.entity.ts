import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AeropuertoReferenciaDocument =
  HydratedDocument<AeropuertoReferencia>;

@Schema({
  collection: 'aeropuertos_referencia',
  timestamps: false,
})
export class AeropuertoReferencia {
  @Prop({ required: true, unique: true })
  icao: string;

  /** Solo presente si hay código IATA comercial (evita índice lleno de vacíos). */
  @Prop({ type: String, uppercase: true, trim: true })
  iata?: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  city: string;

  @Prop({ type: String, default: '' })
  state: string;

  @Prop({ required: true })
  country: string;

  @Prop({ type: Number, default: null })
  elevation: number | null;

  @Prop({ type: Number, default: null })
  lat: number | null;

  @Prop({ type: Number, default: null })
  lon: number | null;

  @Prop({ type: String, default: '' })
  tz: string;

  @Prop({ required: true })
  normName: string;

  @Prop({ required: true })
  normCity: string;
}

export const AeropuertoReferenciaSchema =
  SchemaFactory.createForClass(AeropuertoReferencia);

AeropuertoReferenciaSchema.index({ country: 1, normName: 1 });
AeropuertoReferenciaSchema.index({ country: 1, normCity: 1 });
/**
 * Índice parcial: solo docs con IATA definido (string).
 * No usar $nin/null en el filtro: Atlas / versiones recientes no permiten $not en índices parciales.
 * El seed no persiste `iata` si viene vacío, así que no se indexan aeropuertos sin código IATA.
 */
AeropuertoReferenciaSchema.index(
  { iata: 1 },
  {
    partialFilterExpression: {
      iata: { $exists: true, $type: 'string' },
    },
  },
);
AeropuertoReferenciaSchema.index(
  { name: 'text', city: 'text', iata: 'text', icao: 'text' },
  {
    weights: { iata: 10, icao: 8, name: 5, city: 3 },
    default_language: 'none',
    name: 'aeropuerto_text',
  },
);
