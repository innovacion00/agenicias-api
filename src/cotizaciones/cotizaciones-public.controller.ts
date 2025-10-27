import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CotizacionesService } from './cotizaciones.service';
import { ResponderCotizacionDto } from './dto';

@Controller('cotizaciones/public')
export class CotizacionesPublicController {
  constructor(private readonly cotizacionesService: CotizacionesService) {}

  @Get('token/:tokenAcceso')
  findOneByTokenPublic(@Param('tokenAcceso') tokenAcceso: string) {
    return this.cotizacionesService.findByTokenPublic(tokenAcceso);
  }

  @Get(':id')
  findOneByIdPublic(@Param('id') id: string) {
    return this.cotizacionesService.findByIdPublic(id);
  }

  @Post('responder/:tokenAcceso')
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
