import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class RefreshToken extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId: Types.ObjectId;

  @Prop({
    required: true,
    unique: true,
  })
  token: string;

  @Prop({
    required: true,
  })
  expiresAt: Date;

  @Prop({
    default: true,
  })
  isActive: boolean;

  @Prop({
    default: Date.now,
  })
  createdAt: Date;

  @Prop({
    default: Date.now,
  })
  updatedAt: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// Índice para mejorar performance en consultas
RefreshTokenSchema.index({ userId: 1 });
RefreshTokenSchema.index({ token: 1 });
RefreshTokenSchema.index({ expiresAt: 1 });

// Middleware para actualizar updatedAt
RefreshTokenSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});
