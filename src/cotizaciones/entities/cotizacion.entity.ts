import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { IreservaInfoBd } from 'src/common/interface';
import {
  IAsistente,
  ITitularInfo,
  ValidTipoRecogida,
} from 'src/reservas/interfaces';
import { InfoTouresDto, InfoTransporteDto } from 'src/reservas/dto';
import { VueloMaarLabEntry } from 'src/common/interface';

export enum CotizacionStatus {
  EN_ESPERA = 0,
  ACEPTADA = 1,
  RECHAZADA = 2,
  CONVERTIDA_RESERVA = 3,
}

@Schema({ timestamps: true })
export class Cotizacion extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Agencia', required: true, index: true })
  agenciaId: Types.ObjectId;

  @Prop({ type: String, required: false, index: true })
  hotel: string;

  @Prop({
    type: Number,
    required: false,
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
    type: Number,
    required: true,
    min: 0,
  })
  markup: number;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  porcentajemarkup: number;

  @Prop({
    type: Number,
    default: 0,
  })
  totalMitad: number;

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
    type: String,
    default: '',
  })
  planAlimentario: string;

  @Prop({
    type: {
      numeroVuelo: { type: String, require: true },
      numeroVueloSalida: { type: String },
      aerolinea: { type: String, require: true },
      tipoRecogida: {
        type: Number,
        require: true,
        enum: Object.values(ValidTipoRecogida).filter(
          (val) => typeof val === 'number',
        ),
      },
      firstContactNumber: { type: String, require: true },
      secondContacNumber: { type: String },
      cantidadPersonas: { type: Number, require: true },
    },
  })
  infoTransporte?: InfoTransporteDto;

  @Prop({
    type: {
      nombres: {
        type: [String],
        required: true,
        validate: {
          validator: (arr: string[]) =>
            Array.isArray(arr) &&
            arr.every((item) => typeof item === 'string' && item.trim() !== ''),
          message: 'Todos los nombres deben ser strings no vacíos',
        },
      },
      firstContactNumber: { type: String, required: true },
      secondContacNumber: { type: String },
    },
  })
  infoToures?: InfoTouresDto;

  @Prop({
    type: {
      porcentaje: { type: Number, require: true },
      resultado: { type: Number, require: true },
    },
    default: {
      porcentaje: 0,
      resultado: 0,
    },
  })
  reteFuente: {
    porcentaje: number;
    resultado: number;
  };

  @Prop({
    type: {
      porcentaje: { type: Number, require: true },
      resultado: { type: Number, require: true },
    },
    default: {
      porcentaje: 0,
      resultado: 0,
    },
  })
  reteIva: {
    porcentaje: number;
    resultado: number;
  };

  @Prop({
    type: {
      porcentaje: { type: Number, require: true },
      resultado: { type: Number, require: true },
    },
    default: {
      porcentaje: 0,
      resultado: 0,
    },
  })
  reteIca: {
    porcentaje: number;
    resultado: number;
  };

  @Prop({
    type: Boolean,
    default: false,
  })
  exentoIva: boolean;

  @Prop({
    type: Number,
    default: CotizacionStatus.EN_ESPERA,
    enum: CotizacionStatus,
    index: true,
  })
  status: CotizacionStatus;

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
    required: false,
  })
  cotizacionChatbotId: string;

  @Prop({
    type: String,
    index: true,
    required: true,
  })
  fechaLimiteRespuesta: string;

  @Prop({
    type: String,
    default: '',
  })
  notasSuperAdmin: string;

  @Prop({
    type: String,
    index: true,
    required: true,
  })
  landingUrl: string;

  @Prop({
    type: String,
    default: '',
  })
  landingHtml: string;

  @Prop({
    type: String,
    default: '',
  })
  pdfUrl: string;

  @Prop({
    type: String,
    default: '',
  })
  pdfCloudinaryId: string;

  @Prop({
    type: String,
    required: true,
  })
  tokenAcceso: string;

  @Prop({
    type: Date,
    default: null,
  })
  fechaAprobacion: Date;

  @Prop({
    type: Date,
    default: null,
  })
  fechaRechazo: Date;

  @Prop({
    type: String,
    default: '',
  })
  motivoRechazo: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Reserva',
    default: null,
  })
  reservaId: Types.ObjectId;

  /** Paquetes de vuelo MaarLab (misma estructura que `Reserva.vuelo`). */
  @Prop({
    type: [
      {
        packageId: { type: String, default: '' },
        respuestaMaarLab: { type: Object, default: {} },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  vuelo: VueloMaarLabEntry[];
}

export const CotizacionSchema = SchemaFactory.createForClass(Cotizacion);

// Índices compuestos para optimizar queries comunes
CotizacionSchema.index({ agenciaId: 1, createdAt: -1 });
CotizacionSchema.index({ userId: 1, createdAt: -1 });
CotizacionSchema.index({ tokenAcceso: 1 }, { unique: true });
CotizacionSchema.index({ status: 1, createdAt: -1 });
CotizacionSchema.index({ agenciaId: 1, status: 1, createdAt: -1 });