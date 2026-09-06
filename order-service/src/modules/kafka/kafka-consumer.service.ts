import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { InventoryEventProcessor } from './inventory-event.processor.service.js';

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private kafka!: Kafka;
  private consumer!: Consumer;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventProcessor: InventoryEventProcessor,
  ) {}

  async onModuleInit(): Promise<void> {
    const brokers = this.configService.get<string[]>('app.kafka.brokers', [
      'localhost:9092',
    ]);
    const clientId = this.configService.get<string>(
      'app.kafka.clientId',
      'order-service',
    );
    const inventoryTopic = this.configService.get<string>(
      'app.inventoryTopic',
      'inventory-events',
    );

    this.kafka = new Kafka({
      clientId,
      brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
        maxRetryTime: 30000,
      },
    });

    this.consumer = this.kafka.consumer({
      groupId: 'order-service-inventory-consumer',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      retry: {
        initialRetryTime: 100,
        retries: 8,
        maxRetryTime: 30000,
      },
    });

    try {
      await this.consumer.connect();
      this.logger.log('Kafka consumer connected');

      await this.consumer.subscribe({
        topic: inventoryTopic,
        fromBeginning: false,
      });

      this.logger.log(
        { topic: inventoryTopic },
        'Subscribed to inventory topic',
      );

      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.handleMessage(payload);
        },
      });
    } catch (error) {
      this.logger.error({ error }, 'Failed to start Kafka consumer');
    }
  }

  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;

    const rawValue = message.value?.toString();
    if (!rawValue) {
      this.logger.warn({ topic, partition }, 'Received empty message');
      return;
    }

    await this.eventProcessor.process(
      rawValue,
      { topic, partition },
      message.headers,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.consumer) {
      await this.consumer.disconnect();
      this.logger.log('Kafka consumer disconnected');
    }
  }
}
