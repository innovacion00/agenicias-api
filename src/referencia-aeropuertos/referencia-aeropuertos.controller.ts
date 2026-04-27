import { Controller, Get, Header, Query, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Auth } from 'src/auth/decorators';
import { AirportSuggestQueryDto } from './dto/airport-suggest-query.dto';
import { AeropuertoSugerenciaDto } from './dto/aeropuerto-sugerencia.dto';
import { ReferenciaAeropuertosService } from './referencia-aeropuertos.service';

@ApiTags('referencia-aeropuertos')
@ApiBearerAuth('JWT-auth')
@Auth()
@Controller('referencia-aeropuertos')
export class ReferenciaAeropuertosController {
  constructor(private readonly service: ReferenciaAeropuertosService) {}

  @Get('sugerencias')
  @Throttle({ short: { limit: 200, ttl: 60000 } })
  @Header(
    'Cache-Control',
    'private, max-age=60, stale-while-revalidate=120',
  )
  @ApiOperation({
    summary: 'Búsqueda predictiva de aeropuertos (caché local + MongoDB)',
    description:
      'Consulta rápida sobre datos precargados desde catálogo estático. ' +
      'Sin espacios: coincide por prefijo en nombre, ciudad, IATA o ICAO. ' +
      'Con espacios: búsqueda full-text. Opcional país ISO2.',
  })
  async sugerencias(
    @Query(new ValidationPipe({ transform: true }))
    query: AirportSuggestQueryDto,
  ): Promise<{ count: number; data: AeropuertoSugerenciaDto[] }> {
    const limit = query.limit ?? 20;
    const data = await this.service.suggestPredictivo(query.q, limit, query.country);
    return { count: data.length, data };
  }

  @Get('estado')
  @ApiOperation({
    summary: 'Documentos indexados en aeropuertos_referencia',
    description: 'Útil tras ejecutar el script de seed para verificar la carga.',
  })
  async estado(): Promise<{ count: number }> {
    const count = await this.service.contar();
    return { count };
  }
}
