import { Schema } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class User extends Document {}
