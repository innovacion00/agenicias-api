import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { IreservaInfoBd } from 'src/common/interface';
import { IAsistente, ITitularInfo } from '../interfaces';

@Schema({ timestamps: true })
export class Reserva extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Agencia', required: true, index: true })
  agenciaId: Types.ObjectId;

  @Prop({ type: String, required: true, index: true })
  hotel: string;

  @Prop({
    type: Number,
    required: true,
  })
  cantidadHabitaciones: number;

  @Prop({
    type: Number,
    required: true,
  })
  total: number;

  @Prop({
    type: Boolean,
    default: false,
  })
  exentoIva: boolean;

  /*
  ? 0 Pendiente de pago
  ? 1 En proceso de pago
  ? 2 Pago Rechazado
  ? 3 Pago Aprobado
  ? 4 Cancelado
  */
  @Prop({
    type: Number,
    default: 0,
    index: true,
  })
  status: 0 | 1 | 2 | 3 | 4;

  @Prop({
    type: [
      {
        fullName: { type: String, required: true },
        tipoDocumento: {
          type: String,
          required: true,
          enum: ['CC', 'NIT', 'CE', 'PA'],
        },
        documento: {
          type: String,
          required: true,
        },
        telefono: {
          type: String,
          required: true,
        },
        email: {
          type: String,
          required: true,
        },
      },
    ],
    default: [],
  })
  asistentes: IAsistente[];

  @Prop({
    type: {
      firstName: { type: String, require: true },
      lastName: { type: String, require: true },
      tipoDocumento: { type: String, require: true },
      documento: { type: String, require: true },
      fechaNacimiento: { type: String, require: true },
    },
    require: true,
  })
  titularInfo: ITitularInfo;

  @Prop({
    type: {
      source_of_bussiness: { type: String, default: '' },
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
            nombreHabitacion: { type: String, require: true },
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
    required: true,
  })
  reservation: IreservaInfoBd;

  @Prop({
    type: String,
    index: true,
    required: true,
  })
  reservaChatbotId: string;

  @Prop({
    type: String,
    index: true,
    required: true,
  })
  fechaLimitePago: string;

  @Prop({
    type: {
      link: { type: String, default: '' },
      expirationDate: { type: String, default: '' },
      idLinkPago: { type: String, default: '' },
    },

    default: {
      link: '',
      expirationDate: '',
      idLinkPago: '',
    },
  })
  linkInfo: {
    link: string;
    expirationDate: string;
    idLinkPago: Types.ObjectId;
  };
}

export const ReservaSchema = SchemaFactory.createForClass(Reserva);
