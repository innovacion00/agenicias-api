import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import { CorrelationIdMiddleware } from './correlation-id.middleware';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/agencias/v1/metrics',
      defaultMetrics: { enabled: true, config: { prefix: 'agencias_' } },
    }),
  ],
  providers: [
    makeCounterProvider({
      name: 'agencias_reservas_creadas_total',
      help: 'Total de reservas creadas',
      labelNames: ['provider'],
    }),
    makeCounterProvider({
      name: 'agencias_reservas_canceladas_total',
      help: 'Total de reservas canceladas',
      labelNames: ['motivo'],
    }),
    makeHistogramProvider({
      name: 'agencias_http_outbound_duration_seconds',
      help: 'Latencia de llamadas HTTP salientes',
      labelNames: ['service', 'method', 'status'],
      buckets: [0.1, 0.3, 0.5, 1, 2, 5, 10],
    }),
    makeCounterProvider({
      name: 'agencias_pagos_webhook_total',
      help: 'Total de webhooks de pago recibidos',
      labelNames: ['status', 'provider'],
    }),
  ],
  exports: [PrometheusModule],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
