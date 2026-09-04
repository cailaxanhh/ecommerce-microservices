import { Injectable } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator {
  constructor(private readonly healthIndicatorService: HealthIndicatorService) {}

  async isHealthy(
    key: string,
    client: Redis,
  ): Promise<HealthIndicatorResult> {
    try {
      const pong = await client.ping();
      return this.healthIndicatorService.check(key).up();
    } catch (err) {
      return this.healthIndicatorService.check(key).down((err as Error).message);
    }
  }
}
