import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class Reserva extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Agencia', required: true })
  agencia: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
  })
  correoTitular: string;

  // TODO: Que son los dadtos de titular
  // datosTitular:string;

  @Prop({
    type: String,
    required: true,
  })
  checking: string;

  @Prop({
    type: String,
    required: true,
  })
  checkout: string;

  @Prop({
    type: Number,
    required: true,
  })
  cantidadHabitaciones: number;

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
