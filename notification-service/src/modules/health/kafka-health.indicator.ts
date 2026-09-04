import { Injectable } from '@nestjs/common';
import { HealthIndicatorService, HealthIndicatorResult } from '@nestjs/terminus';
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
    const kafka = new Kafka({ clientId: 'health-check', brokers });
    const admin = kafka.admin();
    try {
      await admin.connect();
      await admin.listTopics();
      await admin.disconnect();
      return this.healthIndicatorService.check(key).up();
    } catch (err) {
      await admin.disconnect().catch(() => {});
      return this.healthIndicatorService
        .check(key)
        .down({ message: (err as Error).message });
    }
  }
}
