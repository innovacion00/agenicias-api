import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Evento extends Document {
    
}

export const EventoSchema = SchemaFactory.createForClass(Evento);
