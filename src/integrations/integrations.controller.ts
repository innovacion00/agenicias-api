import { Controller, Post, Body, Get } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { CreateIntegrationDto } from './dto/create-integration.dto';
import { ApiKeyProtected } from 'src/auth/decorators';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('create')
  create(@Body() createIntegrationDto: CreateIntegrationDto) {
    return this.integrationsService.create(createIntegrationDto);
  }

  @Get('disponibilidad')
  @ApiKeyProtected()
  getDisponibilidad() {
    return {
      hola: 'mundo',
    };
  }
}
