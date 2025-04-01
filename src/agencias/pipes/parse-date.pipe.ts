import { diffDays, isAfter } from '@formkit/tempo';
import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

@Injectable()
export class ParseDatePipe implements PipeTransform {
  transform(value: string, metadata: ArgumentMetadata) {
    const regex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
    const today = new Date().toISOString().slice(0, 10);
    if (!regex.test(value)) {
      throw new BadRequestException(
        'El formato de fecha debe de ser YYYY-MM-DD',
      );
    }

    if (diffDays(value, today) > 0) {
      throw new BadRequestException(
        'Solo se permiten fechas anteriores a la actual',
      );
    }
    return value;
  }
}
