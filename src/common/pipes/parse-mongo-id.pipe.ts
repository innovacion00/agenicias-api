import {
  ArgumentMetadata,
  Injectable,
  PipeTransform,
  BadRequestException,
} from '@nestjs/common';
import { Types, isValidObjectId } from 'mongoose';

@Injectable()
export class ParseMongoIdPipe implements PipeTransform<string, Types.ObjectId> {
  transform(value: string, _metadata: ArgumentMetadata): Types.ObjectId {
    if (value == null || typeof value !== 'string') {
      throw new BadRequestException('ID inválido');
    }
    const trimmed = value.trim();
    if (!isValidObjectId(trimmed)) {
      throw new BadRequestException(`${value} is not a valid MongoID`);
    }

    return new Types.ObjectId(trimmed);
  }
}
