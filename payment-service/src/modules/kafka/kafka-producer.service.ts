import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientKafka } from '@nestjs/microservices';
import { v4 as uuid } from 'uuid';
import { AppConfig } from '../../config/app.config.js';

export interface KafkaMessagePayload {
  eventType: string;
  eventId: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
}

@Injectable()
export class KafkaProducerService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);

  constructor(
    private readonly client: ClientKafka,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const topic = this.config.get('app.kafka.paymentTopic')!;
    await this.client.connect();
    this.logger.log(`Kafka producer connected, topic: ${topic}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  /**
   * Emit a domain event onto the payment-events topic.
   */
  async publishPaymentEvent(event: Omit<KafkaMessagePayload, 'eventId'>): Promise<void> {
    const topic = this.config.get('app.kafka.paymentTopic')!;
    const eventId = uuid();
    const headers: Record<string, string> = {
      eventType: event.eventType,
      eventId,
      correlationId: event.headers?.correlationId || uuid(),
      timestamp: new Date().toISOString(),
    };

    this.logger.debug(`Publishing ${event.eventType} to ${topic}`);

    await this.client.emit(topic, {
      key: event.aggregateId,
      value: JSON.stringify({
        eventType: event.eventType,
        eventId,
        aggregateId: event.aggregateId,
        payload: event.payload,
      }),
      headers,
    });
  }
}
