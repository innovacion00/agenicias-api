import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

@Schema({ timestamps: true, collection: 'payment_pending_personas' })
export class PaymentPending extends Document {
  @Prop({ type: String, required: true, unique: true, index: true })
  payment_code: string;

  @Prop({ type: String, required: true })
  external_ref_id: string;

  @Prop({
    type: String,
    required: true,
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: String, required: true })
  currency: string;

  @Prop({ type: String })
  transaction_id?: string;

  @Prop({ type: Date })
  paid_at?: Date;

  @Prop({ type: String })
  hotel_id?: string;

  @Prop({ type: Object })
  reservation_data?: any; // Datos de la reserva para crear automáticamente

  @Prop({ type: String })
  reserva_id?: string; // ID de la reserva creada (para evitar duplicados)

  @Prop({ type: Boolean, default: false })
  reserva_creada?: boolean; // Flag para saber si ya se creó la reserva
}

export const PaymentPendingSchema =
  SchemaFactory.createForClass(PaymentPending);
