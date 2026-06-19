import { Global, Module, Logger } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: async (): Promise<RedisClientType | null> => {
        const logger = new Logger('RedisModule');
        const url = process.env.REDIS_URL;

        if (!url) {
          logger.warn(
            'REDIS_URL no configurada — throttler y caches usarán memoria local',
          );
          return null;
        }

        try {
          const client = createClient({
            url,
            socket: {
              reconnectStrategy: (retries) => {
                if (retries > 10) return new Error('Max Redis retries');
                return Math.min(retries * 200, 5000);
              },
              connectTimeout: 5000,
            },
          }) as RedisClientType;

          client.on('error', (err) =>
            logger.error(`Redis error: ${err.message}`),
          );
          client.on('reconnecting', () => logger.warn('Redis reconectando…'));

          await client.connect();
          logger.log('Redis conectado correctamente');
          return client;
        } catch (error) {
          logger.warn(
            `No se pudo conectar a Redis (${error instanceof Error ? error.message : String(error)}) — fallback a memoria`,
          );
          return null;
        }
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
