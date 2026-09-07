import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Message, Producer, ProducerRecord } from 'kafkajs';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private kafka!: Kafka;
  private producer!: Producer;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const brokers = this.configService.get('app.kafka.brokers', [
      'localhost:9092',
    ]);
    const clientId = this.configService.get(
      'app.kafka.clientId',
      'order-service',
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

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
    });

    try {
      await this.producer.connect();
      this.isConnected = true;
      this.logger.log('Kafka producer connected');
    } catch (error) {
      this.logger.error({ error }, 'Failed to conect Kafka producer');
    }
  }

  async publish(
    topic: string,
    key: string,
    value: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafak producer is not connected');
    }

    const messages: Message[] = [
      { key, value: JSON.stringify(value), headers: headers ?? {} },
    ];

    await this.producer.send({ topic, messages });
    this.logger.debug({ topic, key }, 'Message published to Kafka');
  }

  async publishBatch(
    topic: string,
    messages: Array<{
      key: string;
      value: Record<string, unknown>;
      headers?: Record<string, string>;
    }>,
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafak producer is not connected');
    }

    const kafkaMessages: Message[] = messages.map((message) => ({
      key: message.key,
      value: JSON.stringify(message.value),
      headers: message.headers ?? {},
    }));

    await this.producer.send({ topic, messages: kafkaMessages });

    this.logger.debug(
      { topic, count: messages.length },
      'Batch messages published',
    );
  }

  async onModuleDestroy() {
    if (this.isConnected && this.producer) {
      await this.producer.disconnect();
      this.isConnected = false;
      this.logger.log('Kafka producer disconnected');
    }
  }
}
