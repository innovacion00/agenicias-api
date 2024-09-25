import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IsNotEmpty, IsString } from 'class-validator';
import { Document, Types } from 'mongoose';
import { User } from 'src/auth/entities/user.entity';

@Schema()
export class Reserva extends Document {
  @IsString()
  @IsNotEmpty()
  hotel: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: User;
}

export const ReservaSchema = SchemaFactory.createForClass(Reserva);
