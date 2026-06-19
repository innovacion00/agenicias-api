import { Inject, Injectable, Logger } from '@nestjs/common';
import { RedisClientType } from 'redis';

import { REDIS_CLIENT } from 'src/redis/redis.module';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly PREFIX = 'cache:';
  private readonly localCache = new Map<
    string,
    { value: string; expiresAt: number }
  >();

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType | null,
  ) {}

  async get<T = any>(key: string): Promise<T | null> {
    const fullKey = `${this.PREFIX}${key}`;

    if (this.redis) {
      try {
        const val = await this.redis.get(fullKey);
        return val ? JSON.parse(val) : null;
      } catch (error) {
        this.logger.error(`Redis GET error: ${error}`);
      }
    }

    const local = this.localCache.get(fullKey);
    if (local && local.expiresAt > Date.now()) {
      return JSON.parse(local.value);
    }
    this.localCache.delete(fullKey);
    return null;
  }

  async set(key: string, value: any, ttlMs = 60000): Promise<void> {
    const fullKey = `${this.PREFIX}${key}`;
    const serialized = JSON.stringify(value);

    if (this.redis) {
      try {
        await this.redis.setEx(fullKey, Math.ceil(ttlMs / 1000), serialized);
        return;
      } catch (error) {
        this.logger.error(`Redis SET error: ${error}`);
      }
    }

    this.localCache.set(fullKey, {
      value: serialized,
      expiresAt: Date.now() + ttlMs,
    });
    this.cleanLocalCache();
  }

  async del(key: string): Promise<void> {
    const fullKey = `${this.PREFIX}${key}`;

    if (this.redis) {
      try {
        await this.redis.del(fullKey);
        return;
      } catch (error) {
        this.logger.error(`Redis DEL error: ${error}`);
      }
    }

    this.localCache.delete(fullKey);
  }

  async increment(key: string, ttlMs = 60000): Promise<number> {
    const fullKey = `${this.PREFIX}${key}`;

    if (this.redis) {
      try {
        const val = await this.redis.incr(fullKey);
        if (val === 1) {
          await this.redis.expire(fullKey, Math.ceil(ttlMs / 1000));
        }
        return val;
      } catch (error) {
        this.logger.error(`Redis INCR error: ${error}`);
      }
    }

    const local = this.localCache.get(fullKey);
    const now = Date.now();
    if (local && local.expiresAt > now) {
      const newVal = (parseInt(local.value, 10) || 0) + 1;
      local.value = String(newVal);
      return newVal;
    }
    this.localCache.set(fullKey, {
      value: '1',
      expiresAt: now + ttlMs,
    });
    return 1;
  }

  private cleanLocalCache() {
    if (this.localCache.size < 5000) return;
    const now = Date.now();
    for (const [k, v] of this.localCache.entries()) {
      if (v.expiresAt <= now) this.localCache.delete(k);
    }
  }
}
