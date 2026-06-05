import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class OtpVerification extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
    unique: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
  })
  otp: string;

  @Prop({
    type: Boolean,
    default: false,
  })
  usado: boolean;

  @Prop({
    type: Date,
    required: true,
  })
  expiresAt: number;
}

export const OtpVerificationSchema =
  SchemaFactory.createForClass(OtpVerification);