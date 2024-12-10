import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { IreservaInfoBd } from '../interfaces';

@Schema()
export class Reserva extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Agencia', required: true })
  agenciaId: Types.ObjectId;

  @Prop({
    type: Number,
    required: true,
  })
  cantidadHabitaciones: number;

  @Prop({
    type: Number,
    required: true,
  })
  precio: number;

  @Prop({
    type: {
      adults: { type: String, require: true },
      checkin: { type: String, require: true },
      checkout: { type: String, require: true },
      children: { type: String, default: '' },
      children_ages: { type: String, default: '' },
      city: { type: String, require: true },
      country: { type: String, require: true },
      currency: { type: String, require: true },
      email: { type: String, require: true },
      telephone: { type: String, require: true },
      firstName: { type: String, require: true },
      lastName: { type: String, require: true },
      nights: { type: String, require: true },
      notes: { type: String, default: '' },
      rooms: { type: String, require: true },
      roomsData: [
        {
          type: {
            adults: { type: String, require: true },
            children: { type: String, require: true },
            checkin: { type: String, require: true },
            checkout: { type: String, require: true },
            currency: { type: String, require: true },
            id: { type: String, require: true },
            quantity: { type: String, require: true },
            rateId: { type: String, require: true },
            unitaryPrice: { type: Number, require: true },
          },
        },
      ],
    },
  })
  reservationInfo: IreservaInfoBd;

  @Prop({
    type: String,
    index: true,
  })
  reservaChatbotId: string;

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
