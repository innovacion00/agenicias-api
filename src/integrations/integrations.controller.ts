import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { CreateIntegrationDto } from './dto/create-integration.dto';
import { ApiKeyProtected, GetIntegration } from 'src/auth/decorators';
import { ValidIntegrationsRoles } from 'src/auth/interfaces';
import { DisponibilidadAutocoreDto } from 'src/reservas/dto';

@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('create')
  @ApiOperation({
    summary: 'Crear integración',
    description: 'Registra una nueva integración externa con sus credenciales y configuración.',
  })
  create(@Body() createIntegrationDto: CreateIntegrationDto) {
    return this.integrationsService.create(createIntegrationDto);
  }

  @Post('disponibilidad')
  @ApiOperation({
    summary: 'Consultar disponibilidad vía integración',
    description: 'Permite a integraciones autorizadas consultar disponibilidad de Autocore usando API key.',
  })
  @HttpCode(200)
  @ApiKeyProtected(ValidIntegrationsRoles.autodoreDev, ValidIntegrationsRoles.autocoreProd)
  getDisponibilidad(
    @Body() disponibilidadAutoCoreDto: DisponibilidadAutocoreDto,
    @GetIntegration('roles') roles: string[],
  ) {
    return this.integrationsService.getDisponibilidad(
      disponibilidadAutoCoreDto,
      roles,
    );
  }
}
