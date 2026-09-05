import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { Kafka } from 'kafkajs';

export class KafkaHealthIndicator extends HealthIndicator {
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
      return this.getStatus(key, true);
    } catch (err) {
      await admin.disconnect().catch(() => {});
      throw new HealthCheckError(
        'Kafka check failed',
        this.getStatus(key, false, { message: (err as Error).message }),
      );
    }
  }
}
