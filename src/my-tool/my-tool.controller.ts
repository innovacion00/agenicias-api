import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MyToolService } from './my-tool.service';
import { ReservaInfoDto } from './dto';

@ApiTags('my-tool')
@Controller('my-tool')
export class MyToolController {
  constructor(private readonly myToolService: MyToolService) {}

  @Get('reservas-info')
  @ApiOperation({
    summary: 'Consultar información de reservas para herramienta interna',
    description: 'Devuelve información consolidada de reservas según parámetros de consulta internos.',
  })
  getReservaInfo(@Query() reservaInfo: ReservaInfoDto) {
    return this.myToolService.getReservaInfo(reservaInfo);
  }
}
