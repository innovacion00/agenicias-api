import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { hotelesAutocoreIds } from 'src/config';

@Injectable()
export class ParseHotelIdPipe implements PipeTransform {
  transform(hotelId: string, _metadata: ArgumentMetadata) {
    if (!hotelesAutocoreIds.includes(hotelId)) {
      throw new BadRequestException(`El id ${hotelId} no es un id valido`);
    }

    return hotelId;
  }
}
