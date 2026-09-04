import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly redis: Redis;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis({
      host: this.config.get<string>('REDIS_HOST', '127.0.0.1'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      lazyConnect: true,
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerStorageRecord> {
    const ttlSeconds = Math.max(Math.ceil(ttl / 1000), 1);
    const blockDurationSeconds = Math.ceil(blockDuration / 1000);

    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, ttlSeconds);
    }

    const ttlRemaining = await this.redis.pttl(key);
    const isBlocked = current > limit;
    let timeToBlockExpire = 0;

    if (isBlocked && blockDurationSeconds > 0) {
      const blockKey = `${key}:block`;
      const wasSet = await this.redis.set(blockKey, '1', 'EX', blockDurationSeconds, 'NX');
      if (wasSet) {
        timeToBlockExpire = blockDuration;
      } else {
        timeToBlockExpire = await this.redis.pttl(blockKey);
      }
    }

    return {
      totalHits: current,
      timeToExpire: Math.max(ttlRemaining, 0),
      isBlocked,
      timeToBlockExpire: Math.max(timeToBlockExpire, 0),
    };
  }
}
