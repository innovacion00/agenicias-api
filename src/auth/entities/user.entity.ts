import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({
    unique: true,
    index: true,
    required: true,
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
  })
  firstLog: boolean;

  @Prop({
    type: [String],
    required: true,
    enum: ['admin', 'user'],
  })
  role: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);
