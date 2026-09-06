import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { Kafka } from 'kafkajs';

@Injectable()
export class KafkaHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(
    key: string,
    brokers: string[],
  ): Promise<HealthIndicatorResult> {
    return await this.healthIndicatorService
      .check(key)
      .attempt(async () => {
        const kafka = new Kafka({ clientId: 'health-check', brokers });
        const admin = kafka.admin();
        try {
          await admin.connect();
          await admin.listTopics();
        } finally {
          await admin.disconnect().catch(() => {});
        }
      })
      .withTimeout(5000);
  }
}