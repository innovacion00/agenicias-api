import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { IreservaInfoBd } from 'src/common/interface';
import { ITitularInfo } from 'src/reservas/interfaces';
import { ValidPaymentStatus } from 'src/reservas/interfaces';

@Schema({ timestamps: true })
export class BookingPersona extends Document {
  @Prop({ type: String, required: true, index: true })
  hotel: string;

  @Prop({
    type: Number,
    required: true,
  })
  cantidadHabitaciones: number;

  @Prop({
    type: String,
  })
  origenIata: string;

  @Prop({
    type: Boolean,
  })
  mascotas: boolean;

  @Prop({
    type: Number,
  })
  mascotasNumber: number;

  @Prop({
    type: Number,
    required: true,
  })
  total: number;

  @Prop({
    type: Boolean,
    default: false,
  })
  adicionCena: boolean;

  @Prop({
    type: Boolean,
    default: false,
  })
  adicionAlmuerzo: boolean;

  @Prop({
    type: Boolean,
    default: false,
  })
  pagadoPrimeraMitad: boolean;

  @Prop({
    type: String,
    default: '',
  })
  planAlimentario: string;

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
  ? 5 Pago mitad
  ? 6 Reserva abonada
  */
  @Prop({
    type: Number,
    default: ValidPaymentStatus.espera,
    enum: ValidPaymentStatus,
    index: true,
  })
  status: ValidPaymentStatus;

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
            children: { type: String, default: '' },
            children_ages: { type: String, default: '' },
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

  @Prop({ type: [String], default: [] })
  paymenIds: string[];

  @Prop({
    type: String,
    index: true,
    required: true,
  })
  fechaLimitePago: string;

  @Prop({
    type: String,
    index: true,
  })
  fechaLimitePago2: string;

  @Prop({
    type: {
      link: { type: String, default: '' },
      expirationDate: { type: Date, default: '' },
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
    idLinkPago: string;
  };

  @Prop({
    type: [
      {
        id: { type: String },
        typeOfPayment: { type: String, default: '' },
        state: { type: Number },
        fecha: { type: Date },
      },
    ],
    default: [],
  })
  linksHistory: Array<{
    id: string;
    typeOfPayment: string;
    state: number;
    fecha: Date;
  }>;
}

export const BookingPersonaSchema = SchemaFactory.createForClass(BookingPersona);

