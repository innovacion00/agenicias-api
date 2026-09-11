import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppConfigService } from './app-config.service';
import { ChangeMaintenanceModeDto } from './dto';
import { Auth } from 'src/auth/decorators';
import { ValidRoles } from 'src/auth/interfaces';

@ApiTags('app-config')
@Controller('app-config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get('estado')
  @ApiOperation({
    summary: 'Estado global de la plataforma (público)',
    description:
      'Devuelve el flag de mantenimiento. Lo consume el frontend para mostrar el cartel de "Plataforma en mantenimiento".',
  })
  getEstado() {
    return this.appConfigService.getEstado();
  }

  @Post('mantenimiento')
  @ApiOperation({
    summary: 'Activar/desactivar modo mantenimiento (superAdmin)',
    description:
      'Persiste el flag de mantenimiento. Activo muestra el cartel en toda la plataforma hasta que se desactive.',
  })
  @Auth(ValidRoles.superAdmin)
  setMaintenance(@Body() changeMaintenanceModeDto: ChangeMaintenanceModeDto) {
    return this.appConfigService.setMaintenance(
      changeMaintenanceModeDto.activo,
    );
  }
}