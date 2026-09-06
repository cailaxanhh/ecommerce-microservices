import { ConfigService } from '@nestjs/config';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { OutboxRepository } from './outbox.repository.js';
import { KafkaProducerService } from '../kafka/kafka-producer.service.js';
import { Outbox } from '../../database/entities/outbox.entity.js';

@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private static readonly INTERVAL_NAME = 'outbox-poll-interval';

  private readonly logger = new Logger(OutboxService.name);
  private readonly pollIntervalMs: number;
  private readonly topic: string;
  private isRunning = false;
  private isShuttingDown = false;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.pollIntervalMs = this.configService.get<number>(
      'app.outboxPollIntervalMs',
      2000,
    );
    this.topic = this.configService.get<string>(
      'app.orderTopic',
      'order-events',
    );
  }

  onModuleInit(): void {
    const callback = () => this.pollOutbox();
    const interval = setInterval(callback, this.pollIntervalMs);
    this.schedulerRegistry.addInterval(OutboxService.INTERVAL_NAME, interval);
    this.logger.log(
      { intervalMs: this.pollIntervalMs },
      'Outbox relay polling started',
    );
  }

  private async pollOutbox(): Promise<void> {
    if (this.isRunning || this.isShuttingDown) {
      return;
    }

    this.isRunning = true;

    try {
      const pendingEntries = await this.outboxRepository.fetchPending(50);

      if (pendingEntries.length === 0) {
        return;
      }

      this.logger.debug(
        { count: pendingEntries.length },
        'Processing outbox entries',
      );

      for (const entry of pendingEntries) {
        await this.processEntry(entry);
      }
    } catch (error) {
      this.logger.error({ error }, 'Outbox poll failed');
    } finally {
      this.isRunning = false;
    }
  }

  private async processEntry(entry: Outbox): Promise<void> {
    try {
      // Build Kafka message headers from outbox headers
      const kafkaHeaders: Record<string, string> = {};

      if (entry.headers) {
        if (entry.headers.correlationId) {
          kafkaHeaders['correlation-id'] = entry.headers
            .correlationId as string;
        }
      }

      // Always include eventId and eventType in headers for idempotent consumption
      kafkaHeaders['event-id'] = entry.eventId;
      kafkaHeaders['event-type'] = entry.eventType;

      // Publish to Kafka
      await this.kafkaProducer.publish(
        this.topic,
        entry.aggregateId,
        entry.payload,
        kafkaHeaders,
      );

      // Mark as sent
      await this.outboxRepository.markSent(entry.id);

      this.logger.debug(
        {
          outboxId: entry.id,
          eventType: entry.eventType,
          aggregateId: entry.aggregateId,
          eventId: entry.eventId,
        },
        'Outbox entry published successfully',
      );
    } catch (error) {
      this.logger.error(
        { outboxId: entry.id, eventType: entry.eventType, error },
        'Failed to publish outbox entry — will retry',
      );

      // Mark failed so it will be retried on next poll cycle
      await this.outboxRepository.markFailed(entry.id);
    }
  }

  onModuleDestroy(): void {
    this.isShuttingDown = true;
    this.schedulerRegistry.deleteInterval(OutboxService.INTERVAL_NAME);
    this.logger.debug('Outbox relay shut down');
  }
}
