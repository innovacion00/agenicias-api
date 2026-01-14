import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/auth/entities/user.entity';

@Schema({ timestamps: true })
export class Agencia extends Document {
  @Prop({
    required: true,
    type: String,
    index: true,
    unique: true,
  })
  emailContacto: string;

  @Prop({
    required: true,
    type: String,
    index: true,
  })
  telefonoContacto: string;

  @Prop({
    required: true,
    type: String,
    lowercase: true,
    trim: true,
    minlength: 2,
    maxlength: 200,
    validate: {
      validator: (v: string) => v.length >= 2 && v.length <= 200,
      message: 'El nombre de la agencia debe tener entre 2 y 200 caracteres',
    },
  })
  fullName: string;

  @Prop({
    unique: true,
    required: true,
    type: String,
    index: true,
  })
  slug: string;

  @Prop({
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: (v: number) => v >= 0,
      message: 'El saldo no puede ser negativo',
    },
  })
  saldo: number;

  //? Agencia 1 para mayoristas 0 para minoristas
  @Prop({
    type: Number,
    required: true,
    index: true,
    enum: [0, 1],
  })
  category: number;

  @Prop({
    required: true,
    type: {
      tipo: { type: String, required: true },
      document: { type: String, required: true, unique: true },
    },
  })
  documentInfo: {
    tipo: 'CC' | 'NIT' | 'CE' | 'PA';
    document: string;
  };

  @Prop({
    required: true,
    type: {
      bolcilloId: { type: String, require: true },
      counterPartyId: { type: String },
    },
  })
  cobreInfo: {
    bolcilloId: string;
    counterPartyId?: string;
  };

  @Prop({
    type: {
      id: { type: Number, require: true },
    },
  })
  autocoreInfo: {
    id: number;
  };

  @Prop({
    type: Boolean,
    default: false,
  })
  empresa: boolean;

  @Prop({
    type: Boolean,
    required: true,
    default: true,
  })
  isActive: boolean;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'User' }],
    default: [],
  })
  usuarios: Types.ObjectId[];

  @Prop({
    required: true,
    default: 1,
    type: Number,
    min: 1,
    max: 100,
    validate: {
      validator: (v: number) => Number.isInteger(v) && v >= 1 && v <= 100,
      message: 'El límite de usuarios debe ser un número entero entre 1 y 100',
    },
  })
  userLimit: number;

  @Prop({
    type: Boolean,
    default: false,
  })
  permisoCartera: boolean;

  @Prop({
    type: String,
    default: '',
  })
  politicasAgencia: string;
}

export const AgenciaSchema = SchemaFactory.createForClass(Agencia);
