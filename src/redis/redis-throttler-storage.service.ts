import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import type { ThrottlerStorage } from '@nestjs/throttler/dist/throttler-storage.interface';
import { RedisClientType } from 'redis';

import { REDIS_CLIENT } from './redis.module';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleInit {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private useRedis = false;
  private memoryStorage = new Map<
    string,
    { totalHits: number; expiresAt: number; blockedUntil: number }
  >();

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType | null,
  ) {}

  onModuleInit() {
    this.useRedis = this.redis !== null && this.redis.isOpen;
    if (this.useRedis) {
      this.logger.log('Throttler storage usando Redis');
    } else {
      this.logger.warn('Throttler storage usando memoria local (sin Redis)');
    }
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const fullKey = `throttle:${throttlerName}:${key}`;

    if (this.useRedis) {
      return this.incrementRedis(fullKey, ttl, limit, blockDuration);
    }
    return this.incrementMemory(fullKey, ttl, limit, blockDuration);
  }

  private async incrementRedis(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerStorageRecord> {
    const redis = this.redis!;
    const blockKey = `${key}:blocked`;
    const ttlSeconds = Math.ceil(ttl / 1000);

    try {
      const blockedTtl = await redis.ttl(blockKey);
      if (blockedTtl > 0) {
        return {
          totalHits: limit + 1,
          timeToExpire: ttlSeconds * 1000,
          isBlocked: true,
          timeToBlockExpire: blockedTtl * 1000,
        };
      }

      const totalHits = await redis.incr(key);
      if (totalHits === 1) {
        await redis.expire(key, ttlSeconds);
      }

      const remainingTtl = await redis.ttl(key);

      if (totalHits > limit && blockDuration > 0) {
        const blockSeconds = Math.ceil(blockDuration / 1000);
        await redis.setEx(blockKey, blockSeconds, '1');
        return {
          totalHits,
          timeToExpire: remainingTtl * 1000,
          isBlocked: true,
          timeToBlockExpire: blockDuration,
        };
      }

      return {
        totalHits,
        timeToExpire: remainingTtl * 1000,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    } catch (error) {
      this.logger.error(
        `Redis throttle error, fallback a memoria: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.useRedis = false;
      return this.incrementMemory(key, ttl, limit, blockDuration);
    }
  }

  private incrementMemory(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): ThrottlerStorageRecord {
    const now = Date.now();

    this.cleanExpiredEntries(now);

    const existing = this.memoryStorage.get(key);

    if (existing && existing.blockedUntil > now) {
      return {
        totalHits: limit + 1,
        timeToExpire: existing.expiresAt - now,
        isBlocked: true,
        timeToBlockExpire: existing.blockedUntil - now,
      };
    }

    if (!existing || existing.expiresAt <= now) {
      this.memoryStorage.set(key, {
        totalHits: 1,
        expiresAt: now + ttl,
        blockedUntil: 0,
      });
      return {
        totalHits: 1,
        timeToExpire: ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    existing.totalHits++;

    if (existing.totalHits > limit && blockDuration > 0) {
      existing.blockedUntil = now + blockDuration;
      return {
        totalHits: existing.totalHits,
        timeToExpire: existing.expiresAt - now,
        isBlocked: true,
        timeToBlockExpire: blockDuration,
      };
    }

    return {
      totalHits: existing.totalHits,
      timeToExpire: existing.expiresAt - now,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }

  private cleanExpiredEntries(now: number) {
    if (this.memoryStorage.size < 5000) return;
    for (const [k, v] of this.memoryStorage.entries()) {
      if (v.expiresAt <= now && v.blockedUntil <= now) {
        this.memoryStorage.delete(k);
      }
    }
  }
}
