import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Reserva } from 'src/reservas/entities/reserva.entity';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({
    unique: true,
    index: true,
    required: true,
    lowercase: true,
  })
  email: string;

  @Prop({
    required: true,
    type: String,
    lowercase: true,
  })
  fullName: string;

  @Prop({
    required: true,
    type: String,
  })
  telefono: string;

  @Prop({
    required: true,
    type: {
      palabra: { type: String, required: true },
      pista: { type: String, required: true },
    },
  })
  validacion: {
    palabra: string;
    pista: string;
  };

  @Prop({
    unique: true,
    required: true,
    type: String,
    index: true,
  })
  slug: string;

  @Prop({
    required: true,
    type: String,
    select: false,
  })
  password: string;

  @Prop({
    type: Number,
    default: 0,
  })
  saldo: number;

  @Prop({
    type: Boolean,
    required: true,
    default: true,
  })
  isActive: boolean;

  @Prop({
    type: Boolean,
    required: true,
    default: false,
  })
  changePassword: boolean;

  @Prop({
    type: Boolean,
    default: true,
  })
  firstLog: boolean;

  @Prop({
    type: [String],
    required: true,
    enum: ['admin', 'user'],
    default: ['user'],
  })
  role: string[];

  @Prop({
    type: Number,
    default: 0,
  })
  changePasswordTries: number;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Reserva' }],
    default: [],
  })
  reservas: Reserva[];
}

export const UserSchema = SchemaFactory.createForClass(User);
