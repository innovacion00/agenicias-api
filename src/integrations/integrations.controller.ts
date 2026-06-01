import {
  Controller,
  Post,
  Body,
  HttpCode,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { CreateIntegrationDto } from './dto/create-integration.dto';
import { ChatBridgeDto } from './dto';
import {
  ApiKeyProtected,
  Auth,
  GetIntegration,
} from 'src/auth/decorators';
import { ValidIntegrationsRoles } from 'src/auth/interfaces';
import { DisponibilidadAutocoreDto } from 'src/reservas/dto';

@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('create')
  @ApiOperation({
    summary: 'Crear integración',
    description:
      'Registra una nueva integración externa con sus credenciales y configuración.',
  })
  create(@Body() createIntegrationDto: CreateIntegrationDto) {
    return this.integrationsService.create(createIntegrationDto);
  }

  @Post('disponibilidad')
  @ApiOperation({
    summary: 'Consultar disponibilidad vía integración',
    description:
      'Permite a integraciones autorizadas consultar disponibilidad de Autocore usando API key.',
  })
  @HttpCode(200)
  @ApiKeyProtected(
    ValidIntegrationsRoles.autodoreDev,
    ValidIntegrationsRoles.autocoreProd,
  )
  getDisponibilidad(
    @Body() disponibilidadAutoCoreDto: DisponibilidadAutocoreDto,
    @GetIntegration('roles') roles: string[],
  ) {
    return this.integrationsService.getDisponibilidad(
      disponibilidadAutoCoreDto,
      roles,
    );
  }

  @Post('chat')
  @ApiOperation({
    summary: 'Enviar mensaje al bridge de chat',
    description:
      'Reenvía mensaje y contexto opcional al bridge POST /chat usando el Bearer token del header Authorization como b2bToken.',
  })
  @ApiBearerAuth('JWT-auth')
  @Auth()
  @HttpCode(200)
  chat(
    @Body() chatBridgeDto: ChatBridgeDto,
    @Headers('authorization') authorization?: string,
  ) {
    const b2bToken = authorization?.replace(/^Bearer\s+/i, '').trim();
    if (!b2bToken) {
      throw new UnauthorizedException(
        'Authorization Bearer token requerido',
      );
    }

    return this.integrationsService.chat(chatBridgeDto, b2bToken);
  }
}
