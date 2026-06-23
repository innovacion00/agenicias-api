import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private mongo: MongooseHealthIndicator,
  ) {}

  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Verificar si la aplicación está viva' })
  checkLive() {
    return this.health.check([
      () => this.mongo.pingCheck('mongodb', { timeout: 5000 }),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Verificar si la aplicación está lista (dependencies)',
  })
  checkReady() {
    return this.health.check([
      () => this.mongo.pingCheck('mongodb', { timeout: 5000 }),
    ]);
  }
}
