import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import { KafkaHealthIndicator } from './kafka-health.indicator.js';
import { RedisHealthIndicator } from './redis-health.indicator.js';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [KafkaHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
