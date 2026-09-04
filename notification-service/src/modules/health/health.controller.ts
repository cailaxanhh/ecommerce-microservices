import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { KafkaHealthIndicator } from './kafka-health.indicator.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly kafka: KafkaHealthIndicator,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  liveness() {
    return {
      status: 'ok',
      service: 'notification-service',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  readiness() {
    const brokers = this.config
      .get<string>('KAFKA_BROKERS', 'localhost:9092')
      .split(',')
      .map((b) => b.trim());

    return this.health.check([
      () => this.db.pingCheck('database', { connection: this.dataSource }),
      () => this.kafka.isHealthy('kafka', brokers),
      () => this.memory.checkRSS('memory', 300 * 1024 * 1024),
    ]);
  }
}
