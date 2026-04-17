import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { hotelMyToolSlugs } from 'src/config';

@Injectable()
export class ParseHotelSlugPipe implements PipeTransform {
  transform(slug: string, _metadata: ArgumentMetadata) {
    const normalized = slug.toLowerCase().trim();
    if (!hotelMyToolSlugs.includes(normalized)) {
      throw new BadRequestException(
        `El hotel '${slug}' no es valido. Hoteles disponibles: ${hotelMyToolSlugs.join(', ')}`,
      );
    }
    return normalized;
  }
}
