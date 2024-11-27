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
  })
  saldo: number;

  // ? Agencia 1 para mayoristas 0 para minoristas
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
    tipo: 'CC' | 'NIT' | 'CA' | 'PA';
    document: string;
  };

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
  usuarios: User[];

  @Prop({
    required: true,
    default: 1,
    type: Number,
  })
  userLimit: number;
}

export const AgenciaSchema = SchemaFactory.createForClass(Agencia);
