import { Controller, Get, Query } from '@nestjs/common';
import { MyToolService } from './my-tool.service';
import { ReservaInfoDto } from './dto';

@Controller('my-tool')
export class MyToolController {
  constructor(private readonly myToolService: MyToolService) {}

  // @Get('reservas-info')
  // getReservaInfo(@Query() reservaInfo: ReservaInfoDto) {
  //   return this.myToolService.getReservaInfo(reservaInfo);
  // }
}
