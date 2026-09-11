import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';

@Schema({ timestamps: true })
export class AppConfig extends Document {
  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
    lowercase: true,
  })
  key: string;

  @Prop({ type: SchemaTypes.Mixed })
  value?: unknown;
}

export const AppConfigSchema = SchemaFactory.createForClass(AppConfig);