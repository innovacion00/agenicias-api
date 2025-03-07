import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ValidRoles } from '../interfaces';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({
    unique: true,
    index: true,
    required: true,
    lowercase: true,
    type: String,
  })
  email: string;

  @Prop({
    required: true,
    type: String,
    select: false,
  })
  password: string;

  @Prop({
    required: true,
    type: String,
  })
  telefono: string;

  @Prop({
    required: true,
    type: String,
    lowercase: true,
  })
  fullName: string;

  @Prop({
    type: Boolean,
    required: true,
    default: true,
  })
  isActive: boolean;

  @Prop({
    type: Boolean,
    default: true,
  })
  firstLog: boolean;

  @Prop({
    type: [String],
    required: true,
    enum: Object.values(ValidRoles),
    default: [ValidRoles.admin],
  })
  role: string[];

  @Prop({
    type: String,
  })
  imageUrl: string;

  @Prop({ type: Types.ObjectId, ref: 'Agencia', required: true })
  agencia: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'OtpVerification',
    default: null,
  })
  otpRef: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Reserva' }],
    default: [],
  })
  reservas: Types.ObjectId[];

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Evento' }],
    default: [],
  })
  eventos: Types.ObjectId[];
}

export const UserSchema = SchemaFactory.createForClass(User);
