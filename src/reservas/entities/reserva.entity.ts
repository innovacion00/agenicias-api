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

  @Prop({
    type: {
      link: { type: String, default: '' },
      expirationDate: { type: String, default: '' },
      rastreador: { type: String, default: '' },
    },
    default: {
      link: '',
      expirationDate: '',
      rastreador: '',
    },
  })
  linkInfo: {
    link: string;
    expirationDate: string;
    rastreador: string;
  };
}

export const ReservaSchema = SchemaFactory.createForClass(Reserva);
