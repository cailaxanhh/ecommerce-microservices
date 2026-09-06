import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { Redis } from 'ioredis';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string, client: Redis): Promise<HealthIndicatorResult> {
    return await this.healthIndicatorService
      .check(key)
      .attempt(async () => {
        const pong = await client.ping();
        if (pong !== 'PONG') {
          throw new Error(`Redis ping failed: ${pong}`);
        }
      })
      .withTimeout(5000);
  }
}