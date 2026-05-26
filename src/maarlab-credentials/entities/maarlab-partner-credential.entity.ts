import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MaarlabPartnerCredentialDocument =
  HydratedDocument<MaarlabPartnerCredential>;

/**
 * Credenciales por search engine devueltas por MaarLab (`api_keys_by_partner`).
 * Vínculo con `Agencia` por `agenciaId` (sync) o por `normHotelName` ≈ nombre normalizado de la agencia.
 */
@Schema({ collection: 'maarlab_partner_credentials', timestamps: true })
export class MaarlabPartnerCredential {
  @Prop({ required: true, unique: true })
  idSearchEngine: string;

  @Prop({ required: true, index: true })
  hotelName: string;

  /** Nombre MaarLab normalizado para emparejar con `Agencia.fullName` / `slug`. */
  @Prop({ required: true })
  normHotelName: string;

  @Prop({ required: true })
  apiKey: string;

  @Prop({ type: Types.ObjectId, ref: 'Agencia', default: null, index: true })
  agenciaId: Types.ObjectId | null;

  @Prop({ type: Date, required: true })
  lastSyncedAt: Date;
}

export const MaarlabPartnerCredentialSchema = SchemaFactory.createForClass(
  MaarlabPartnerCredential,
);

MaarlabPartnerCredentialSchema.index({ agenciaId: 1, hotelName: 1 });
MaarlabPartnerCredentialSchema.index({ normHotelName: 1 });
