import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { IUserSettings, ValidRoles } from '../interfaces';

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
    trim: true,
    validate: {
      validator: (v: string) => /^\+?[1-9]\d{1,14}$/.test(v.replace(/\s/g, '')),
      message: 'El teléfono debe tener un formato válido',
    },
  })
  telefono: string;

  @Prop({
    required: true,
    type: String,
    lowercase: true,
    trim: true,
    minlength: 2,
    maxlength: 100,
    validate: {
      validator: (v: string) => v.length >= 2 && v.length <= 100,
      message: 'El nombre completo debe tener entre 2 y 100 caracteres',
    },
  })
  fullName: string;

  @Prop({
    type: Boolean,
    required: true,
    default: true,
  })
  isActive: boolean;

  @Prop({
    type: {
      omitirOtp: { type: Boolean, default: false },
    },
    default: {
      omitirOtp: false,
    },
  })
  settings: IUserSettings;

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
    default: '',
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

  @Prop({
    type: String,
    default: '',
  })
  politicasAgencia: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
