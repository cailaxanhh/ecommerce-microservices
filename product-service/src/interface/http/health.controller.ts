import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Public } from './decorators/public.decorator';
import { RedisHealthIndicator } from './redis-health.indicator';

@Controller('health')
export class HealthController {
  private readonly redisClient: Redis;

  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {
    this.redisClient = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      lazyConnect: true,
    });
  }

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  check() {
    return {
      status: 'ok',
      service: 'product-service',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database', { connection: this.dataSource }),
      () => this.redisIndicator.isHealthy('redis', this.redisClient),
      () => this.memory.checkRSS('memory', 300 * 1024 * 1024),
    ]);
  }
}
