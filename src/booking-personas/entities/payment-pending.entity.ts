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

  @Prop({ type: String, required: true, enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: String, required: true })
  currency: string;

  @Prop({ type: String })
  transaction_id?: string;

  @Prop({ type: Date })
  paid_at?: Date;
}

export const PaymentPendingSchema = SchemaFactory.createForClass(PaymentPending);

