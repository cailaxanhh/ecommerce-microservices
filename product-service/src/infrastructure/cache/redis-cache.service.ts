import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly defaultTtl: number;
  private readonly logger = new Logger(RedisCacheService.name);

  constructor(private readonly config: ConfigService) {
    this.defaultTtl = this.config.get<number>('REDIS_TTL', 300);

    this.client = new Redis({
      host: this.config.get<string>('REDIS_HOST'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 2000);
        return delay;
      },
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis connection error', err.stack);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtl;
    await this.client.set(key, JSON.stringify(value), 'EX', ttl);
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length) {
      await this.client.del(...keys);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern);
    if (keys.length) {
      await this.client.del(...keys);
    }
  }
}
