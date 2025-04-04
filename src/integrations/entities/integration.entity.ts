import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ValidIntegrationsRoles } from 'src/auth/interfaces';

@Schema({ timestamps: true })
export class Integration extends Document {
  @Prop({
    type: String,
    required: true,
    lowercase: true,
    index: true,
    unique: true,
  })
  name: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
  })
  apiKey: string;

  @Prop({
    type: String,
    required: true,
  })
  secretKey: string;

  @Prop({
    type: Boolean,
    required: true,
    default: false,
  })
  isActive: boolean;

  @Prop({
    type: [String],
    required: true,
    enum: Object.values(ValidIntegrationsRoles),
    default: [],
  })
  roles: string[];
}

export const IntegrationSchema = SchemaFactory.createForClass(Integration);
