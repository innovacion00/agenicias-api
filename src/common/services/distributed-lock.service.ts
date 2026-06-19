import { Inject, Injectable, Logger } from '@nestjs/common';
import { RedisClientType } from 'redis';
import { randomUUID } from 'crypto';

import { REDIS_CLIENT } from 'src/redis/redis.module';

@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType | null,
  ) {}

  async acquireLock(
    key: string,
    ttlMs: number,
    maxRetries = 0,
  ): Promise<string | null> {
    if (!this.redis) return randomUUID();

    const token = randomUUID();
    const lockKey = `lock:${key}`;
    const ttlSeconds = Math.ceil(ttlMs / 1000);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.redis.set(lockKey, token, {
          NX: true,
          EX: ttlSeconds,
        });
        if (result === 'OK') return token;
      } catch (error) {
        this.logger.error(
          `Error adquiriendo lock ${key}: ${error instanceof Error ? error.message : String(error)}`,
        );
        return randomUUID();
      }

      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
      }
    }

    return null;
  }

  async releaseLock(key: string, token: string): Promise<boolean> {
    if (!this.redis) return true;

    const lockKey = `lock:${key}`;
    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      const result = await this.redis.eval(script, {
        keys: [lockKey],
        arguments: [token],
      });
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Error liberando lock ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  async tryLock<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs = 30000,
  ): Promise<T | null> {
    const token = await this.acquireLock(key, ttlMs);
    if (!token) {
      this.logger.warn(`No se pudo adquirir lock: ${key}`);
      return null;
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(key, token);
    }
  }
}
