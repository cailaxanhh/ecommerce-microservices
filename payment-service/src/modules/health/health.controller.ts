import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { KafkaHealthIndicator } from './kafka-health.indicator.js';
import { RedisHealthIndicator } from './redis-health.indicator.js';

@Controller()
export class HealthController {
  private readonly redisClient: Redis;

  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly kafka: KafkaHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {
    this.redisClient = new Redis({
      host: this.config.get<string>('app.redis.host', 'localhost'),
      port: this.config.get<number>('app.redis.port', 6379),
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      lazyConnect: true,
    });
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  liveness() {
    return {
      status: 'ok',
      service: 'payment-service',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health/ready')
  readiness() {
    const brokers = this.config.get<string[]>('app.kafka.brokers', ['localhost:9092']);

    return this.health.check([
      () => this.db.pingCheck('database', { connection: this.dataSource }),
      () => this.redisIndicator.isHealthy('redis', this.redisClient),
      () => this.kafka.isHealthy('kafka', brokers),
      () => this.memory.checkRSS('memory', 300 * 1024 * 1024),
    ]);
  }
}
