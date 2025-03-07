import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  alimentosYBebidas,
  horarioEvento,
  TipoAcomodacion,
  TipoEvento,
} from '../interfaces';

@Schema({ timestamps: true })
export class Evento extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Agencia', required: true, index: true })
  agenciaId: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    index: true,
    lowercase: true,
  })
  nameEvento: string;

  @Prop({
    type: Number,
    required: true,
    index: true,
    enum: TipoEvento,
  })
  tipoEvento: TipoEvento;

  @Prop({
    type: String,
    required: true,
    index: true,
    lowercase: true,
  })
  nombreOrganizador: string;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  telefonoOrganizador: string;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  emailOrganizador: string;

  @Prop({
    type: Number,
    required: true,
  })
  cantidadAsistentes: number;

  @Prop({
    type: Date,
    required: true,
  })
  fechaInicioEvento: string;

  @Prop({
    type: Date,
    required: true,
  })
  fechaFinalEvento: string;

  @Prop({
    type: [
      {
        fechaInicio: { type: Date, require: true },
        fechaFinal: { type: Date, require: true },
        cantidadAsistenteDia: { type: Number, require: true },
      },
    ],
    required: true,
  })
  horarioEvento: horarioEvento[];

  @Prop({
    type: Boolean,
    default: false,
  })
  flexibilidadEvento: boolean;

  @Prop({
    type: Number,
    enum: TipoAcomodacion,
    required: true,
  })
  tipoAcomodacion: TipoAcomodacion;

  @Prop({
    type: Boolean,
    default: false,
  })
  alimentacion: boolean;

  @Prop({
    type: {
      estacionCafe: { type: Boolean, default: false },
      coffeBreak: { type: Boolean, default: false },
      desayuno: { type: Boolean, default: false },
      almuerzo: { type: Boolean, default: false },
      cena: { type: Boolean, default: false },
    },
    default: {
      estacionCafe: false,
      coffeBreak: false,
      desayuno: false,
      almuerzo: false,
      cena: false,
    },
  })
  alimentosBebidas: alimentosYBebidas;

  @Prop({
    type: Boolean,
    default: false,
  })
  audiovisuales: boolean;

  @Prop({
    type: [String],
    default: [],
  })
  itemsAudiovisuales: string[];

  @Prop({
    type: Boolean,
    default: false,
  })
  decaracion: boolean;

  @Prop({
    type: String,
    default: '',
  })
  decaracionDescripcion: string;

  @Prop({
    type: Boolean,
    default: false,
  })
  alojamiento: boolean;

  @Prop({
    type: String,
    default: '',
  })
  observaciones: string;
}

export const EventoSchema = SchemaFactory.createForClass(Evento);
