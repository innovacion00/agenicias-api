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

    const audiovisuales = createReservaEventoDto.audiovisuales;

    const decoracion = createReservaEventoDto.decoracion;

    if (!alimentacion) {
      delete createReservaEventoDto.alimentosBebidas;
    }

    if (!audiovisuales) {
      delete createReservaEventoDto.itemsAudiovisuales;
    }

    if (!decoracion) {
      delete createReservaEventoDto.decaracionDescripcion;
    }

    return createReservaEventoDto;
  }
}
