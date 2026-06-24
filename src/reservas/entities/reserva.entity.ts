import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { IreservaInfoBd } from 'src/common/interface';
import {
  IAsistente,
  ITitularInfo,
  LinksHistory,
  ValidPaymentStatus,
  ValidTipoRecogida,
} from '../interfaces';
import { InfoTouresDto, InfoTransporteDto } from '../dto';

@Schema({ timestamps: true })
export class Reserva extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Agencia', required: true, index: true })
  agenciaId: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    index: true,
    trim: true,
    validate: {
      validator: (v: string) => v.length > 0 && v.length <= 200,
      message: 'El nombre del hotel debe tener entre 1 y 200 caracteres',
    },
  })
  hotel: string;

  @Prop({
    type: Number,
    required: true,
    min: 1,
    max: 100,
    validate: {
      validator: (v: number) => Number.isInteger(v) && v > 0 && v <= 100,
      message:
        'La cantidad de habitaciones debe ser un número entero entre 1 y 100',
    },
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
    min: 0,
    validate: {
      validator: (v: number) => v > 0,
      message: 'El total debe ser mayor a 0',
    },
  })
  total: number;

  @Prop({
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: (v: number) => v >= 0,
      message: 'El totalMitad no puede ser negativo',
    },
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
    type: Boolean,
    default: false,
    index: true,
  })
  cancelInProgress: boolean;

  @Prop({
    type: Date,
    default: null,
    index: true,
  })
  cancelRequestedAt?: Date;

  @Prop({
    type: Date,
    default: null,
  })
  cancelProcessedAt?: Date;

  @Prop({
    type: String,
    default: '',
  })
  cancelOpId?: string;

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
            room_id: { type: String, default: '' },
          },
        },
      ],
    },
    required: true,
  })
  reservation: IreservaInfoBd;

  @Prop({
    type: String,
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
    type: String,
    default: '',
  })
  notasSuperAdmin: string;

  @Prop({
    type: String,
    default: '',
  })
  notasagencias: string;

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
    idLinkPago: Types.ObjectId;
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
  linksHistory: LinksHistory[];

  @Prop({
    type: String,
    enum: ['autocore', 'mytool'],
    default: 'autocore',
    index: true,
  })
  reservaProvider: string;

  @Prop({ type: Number, default: null })
  myToolCanalVentaId: number;

  // #region MaarLab flights (interno)
  @Prop({
    type: [
      {
        packageId: { type: String, default: '' },
        // Guardamos toda la respuesta de MaarLab de bookPackage, excepto el objeto "hotel"
        respuestaMaarLab: { type: Object, default: {} },
        createdAt: { type: Date, default: Date.now },
        paymentStatus: { type: String, default: 'pending' },
        paymentUpdatedAt: { type: Date, default: null },
        bookingStatus: { type: String, default: '' },
        lastWebhookType: { type: String, default: '' },
      },
    ],
    default: [],
  })
  vuelo: Array<{
    packageId: string;
    respuestaMaarLab: Record<string, any>;
    createdAt: Date;
    paymentStatus?: string;
    paymentUpdatedAt?: Date;
    bookingStatus?: string;
    lastWebhookType?: string;
  }>;
  // #endregion MaarLab flights (interno)

  @Prop({
    type: Boolean,
    default: false,
    index: true,
  })
  esReactivacion: boolean;

  @Prop({
    type: Types.ObjectId,
    ref: 'Reserva',
    default: null,
  })
  reactivacionDeReservaId?: Types.ObjectId;

  @Prop({
    type: Date,
    default: null,
  })
  reactivacionExpiraEn?: Date;

  @Prop({
    type: Types.ObjectId,
    ref: 'Reserva',
    default: null,
  })
  reactivacionNuevaReservaId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['pendiente_pago', 'completada', 'expirada'],
    default: null,
  })
  reactivacionEstado?: 'pendiente_pago' | 'completada' | 'expirada';

  @Prop({
    type: Boolean,
    default: false,
  })
  reactivacionCorreoFalloEnviado: boolean;

  @Prop({
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: (v: number) => v >= 0,
      message: 'El abono no puede ser negativo',
    },
  })
  abono: number;
}

export const ReservaSchema = SchemaFactory.createForClass(Reserva);

// Índices compuestos para optimizar queries comunes
ReservaSchema.index({ userId: 1, status: 1, createdAt: -1 });
ReservaSchema.index({ agenciaId: 1, status: 1, createdAt: -1 });
ReservaSchema.index({ reservaChatbotId: 1 }, { unique: true });
ReservaSchema.index({ fechaLimitePago: 1, status: 1 }); // Para queries de pagos pendientes
ReservaSchema.index({ status: 1, createdAt: -1 }); // Para listados por estado
ReservaSchema.index({ cancelInProgress: 1, cancelRequestedAt: 1 }); // Para reconciliar locks colgados
// Índice adicional para optimizar paginación con sort por createdAt
ReservaSchema.index({ createdAt: -1 }); // Para queries de paginación sin filtros adicionales
