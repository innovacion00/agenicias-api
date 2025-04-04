import { Controller, Post, Body, Get, HttpCode } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { CreateIntegrationDto } from './dto/create-integration.dto';
import { ApiKeyProtected } from 'src/auth/decorators';
import { ValidIntegrationsRoles } from 'src/auth/interfaces';
import { DisponibilidadAutocoreDto } from 'src/reservas/dto';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('create')
  create(@Body() createIntegrationDto: CreateIntegrationDto) {
    return this.integrationsService.create(createIntegrationDto);
  }

  @Post('disponibilidad')
  @HttpCode(200)
  @ApiKeyProtected(ValidIntegrationsRoles.autodoreDev)
  getDisponibilidad(
    @Body() disponibilidadAutoCoreDto: DisponibilidadAutocoreDto,
  ) {
    return this.integrationsService.getDisponibilidad(
      disponibilidadAutoCoreDto,
    );
  }
}
