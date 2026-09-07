import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, EachMessagePayload, KafkaMessage } from 'kafkajs';
import { KafkaEventProcessor } from './kafka-event.processor.service.js';

@Injectable()
export class KafkaConsumerService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private readonly kafka: Kafka;
  private readonly consumers: Consumer[] = [];

  constructor(
    private readonly config: ConfigService,
    private readonly processor: KafkaEventProcessor,
  ) {
    const brokers = this.config
      .get<string>('KAFKA_BROKERS', 'localhost:9092')
      .split(',')
      .map((b) => b.trim());

    this.kafka = new Kafka({
      clientId: this.config.get<string>(
        'KAFKA_CLIENT_ID',
        'notification-service',
      ),
      brokers,
    });
  }

  async onModuleInit(): Promise<void> {
    const orderTopic = this.config.get<string>('ORDER_TOPIC', 'order-events');
    const inventoryTopic = this.config.get<string>(
      'INVENTORY_TOPIC',
      'inventory-events',
    );

    await this.createConsumer([orderTopic, inventoryTopic]);

    this.logger.log(
      `Kafka consumer started on topics: ${orderTopic}, ${inventoryTopic}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    for (const consumer of this.consumers) {
      await consumer.disconnect();
    }
    this.logger.log('Kafka consumers disconnected');
  }

  private async createConsumer(topics: string[]): Promise<void> {
    const consumer = this.kafka.consumer({
      groupId: 'notification-service',
      allowAutoTopicCreation: true,
    });

    await consumer.connect();
    for (const topic of topics) {
      await consumer.subscribe({ topic, fromBeginning: false });
    }

    await consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        await this.handleMessage(payload);
      },
    });

    this.consumers.push(consumer);
  }

  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;
    const raw = this.extractMessage(message);
    if (!raw) {
      this.logger.warn(`Empty message on topic ${topic}, skipping`);
      return;
    }

    const headers: Record<string, string> = {};
    if (message.headers) {
      for (const [key, value] of Object.entries(message.headers)) {
        if (value) {
          if (Array.isArray(value)) {
            headers[key] = Buffer.concat(
              value.map((h) => Buffer.from(h)),
            ).toString();
          } else {
            headers[key] = Buffer.from(value).toString();
          }
        }
      }
    }

    await this.processor.process(raw, {
      topic,
      partition,
      headers,
    });
  }

  private extractMessage(message: KafkaMessage): string | null {
    const value = message.value;
    if (!value) return null;
    return value.toString();
  }
}