import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CotizacionesService } from './cotizaciones.service';
import { ResponderCotizacionDto } from './dto';

@ApiTags('cotizaciones-public')
@Controller('cotizaciones/public')
export class CotizacionesPublicController {
  constructor(private readonly cotizacionesService: CotizacionesService) {}

  @Get('token/:tokenAcceso')
  @ApiOperation({
    summary: 'Consultar cotización pública por token',
    description:
      'Permite consultar una cotización sin autenticación usando su token público.',
  })
  findOneByTokenPublic(@Param('tokenAcceso') tokenAcceso: string) {
    return this.cotizacionesService.findByTokenPublic(tokenAcceso);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar cotización pública por ID',
    description: 'Permite consultar una cotización pública por identificador.',
  })
  findOneByIdPublic(@Param('id') id: string) {
    return this.cotizacionesService.findByIdPublic(id);
  }

  @Post('responder/:tokenAcceso')
  @ApiOperation({
    summary: 'Responder cotización pública',
    description:
      'Permite registrar respuesta a una cotización desde el flujo público.',
  })
  responderCotizacionPublic(
    @Param('tokenAcceso') tokenAcceso: string,
    @Body() responderCotizacionDto: ResponderCotizacionDto,
  ) {
    return this.cotizacionesService.responderCotizacion(
      tokenAcceso,
      responderCotizacionDto,
    );
  }
}
