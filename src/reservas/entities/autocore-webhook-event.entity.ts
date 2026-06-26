import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AutocoreWebhookEventResult =
  | 'applied'
  | 'noop'
  | 'skipped'
  | 'alert'
  | 'error';

export type AutocoreWebhookEventSource =
  | 'autocore'
  | 'billetera'
  | 'reprocess';

@Schema({ timestamps: true, collection: 'autocore_webhook_events' })
export class AutocoreWebhookEvent extends Document {
  @Prop({ type: String, required: true, index: true })
  result: AutocoreWebhookEventResult;

  @Prop({ type: String, required: true, default: 'autocore' })
  source: AutocoreWebhookEventSource;

  @Prop({ type: String, default: null, index: true })
  reservaId: string | null;

  @Prop({ type: String, default: '' })
  reservaChatbotId: string;

  @Prop({ type: String, default: '' })
  paymentStatusRaw: string;

  @Prop({ type: String, default: '' })
  paymentStatusClass: string;

  @Prop({ type: String, default: '' })
  externalRefId: string;

  @Prop({ type: String, default: '' })
  transactionId: string;

  @Prop({ type: String, default: '' })
  reason: string;

  @Prop({ type: Number, default: null })
  statusBefore: number | null;

  @Prop({ type: Number, default: null })
  statusAfter: number | null;

  @Prop({ type: Object, default: {} })
  payload: Record<string, unknown>;

  @Prop({ type: Boolean, default: false })
  alertSent: boolean;
}

export const AutocoreWebhookEventSchema =
  SchemaFactory.createForClass(AutocoreWebhookEvent);

AutocoreWebhookEventSchema.index({ createdAt: -1 });
AutocoreWebhookEventSchema.index({ reservaId: 1, createdAt: -1 });
