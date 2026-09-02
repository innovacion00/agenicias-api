import { Controller, Get, Header, Query, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PrecioExtraQueryDto } from './dto';
import { PreciosExtrasService } from './precios-extras.service';

@ApiTags('precios-extras-public')
@Controller('precios-extras/public')
export class PreciosExtrasPublicController {
  constructor(private readonly service: PreciosExtrasService) {}

  @Get()
  @Throttle({ short: { limit: 200, ttl: 60000 } })
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
  @ApiOperation({
    summary: 'Catálogo público de precios de extras',
    description:
      'Filtrable por hotel, ciudad y concepto. Devuelve items activos y en ' +
      'vigencia. Los precios globales (hotelId null) siempre se incluyen. ' +
      'Moneda (A): par autoritativo COP/USD sin conversión; `precio` refleja ' +
      'la divisa pedida (COP por defecto).',
  })
  consultar(
    @Query(new ValidationPipe({ transform: true }))
    query: PrecioExtraQueryDto,
  ) {
    return this.service.consultarPublica(query);
  }
}