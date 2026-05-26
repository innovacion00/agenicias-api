import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MaarlabWebhookService } from './services/maarlab-webhook.service';

@ApiTags('vuelos-maarlab-webhooks')
@Controller('vuelos/maarlab/webhooks')
export class MaarlabWebhookController {
  constructor(private readonly webhookService: MaarlabWebhookService) {}

  private mergePayload(
    query: Record<string, unknown>,
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    return { ...query, ...(body && typeof body === 'object' ? body : {}) };
  }

  @Get('booking')
  @Post('booking')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook MaarLab — reserva de paquete (booking)',
    description:
      'Callback público (GET/POST). MaarLab notifica con package_id en query o body.',
  })
  booking(
    @Query() query: Record<string, unknown>,
    @Body() body: Record<string, unknown>,
  ) {
    return this.webhookService.handleWebhook(
      'booking',
      this.mergePayload(query, body),
    );
  }

  @Get('payment')
  @Post('payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook MaarLab — pago de vuelo',
    description:
      'Actualiza estado de pago del vuelo en la reserva y notifica por email a la agencia si el pago fue exitoso.',
  })
  payment(
    @Query() query: Record<string, unknown>,
    @Body() body: Record<string, unknown>,
  ) {
    return this.webhookService.handleWebhook(
      'payment',
      this.mergePayload(query, body),
    );
  }

  @Get('canceled')
  @Post('canceled')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook MaarLab — cancelación de paquete' })
  canceled(
    @Query() query: Record<string, unknown>,
    @Body() body: Record<string, unknown>,
  ) {
    return this.webhookService.handleWebhook(
      'canceled',
      this.mergePayload(query, body),
    );
  }

  @Get('contracting')
  @Post('contracting')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook MaarLab — contratación (contracting)' })
  contracting(
    @Query() query: Record<string, unknown>,
    @Body() body: Record<string, unknown>,
  ) {
    return this.webhookService.handleWebhook(
      'contracting',
      this.mergePayload(query, body),
    );
  }
}
