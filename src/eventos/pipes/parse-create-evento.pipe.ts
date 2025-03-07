import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { CreateReservaEventoDto } from '../dto';

@Injectable()
export class ParseCreateEventoPipe implements PipeTransform {
  transform(
    createReservaEventoDto: CreateReservaEventoDto,
    metadata: ArgumentMetadata,
  ) {
    const alimentacion = createReservaEventoDto.alimentacion;

    if (!alimentacion) {
      delete createReservaEventoDto.alimentosBebidas;
    }

    return createReservaEventoDto;
  }
}
