import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { KafkaProducerService } from '../kafka/kafka-producer.service.js';
import { OutboxService } from './outbox.service.js';

/**
 * Polls the outbox table on a schedule and relays pending events to Kafka.
 * Uses FOR UPDATE SKIP LOCKED for horizontal scalability.
 */
@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);
  private isRunning = false;

  constructor(
    private readonly outboxService: OutboxService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Dynamic cron via schedule library is limited, so we poll with a
   * setInterval that respects the config interval. The @Cron decorator
   * below acts as a fallback every 10 seconds.
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async poll(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const pending = await this.outboxService.fetchPending(100);
      if (pending.length === 0) {
        return;
      }

      this.logger.log(`Relaying ${pending.length} outbox event(s)`);

      const sentIds: string[] = [];

      for (const row of pending) {
        try {
          await this.kafkaProducer.publishPaymentEvent({
            eventType: row.eventType,
            aggregateId: row.aggregateId,
            payload: row.payload,
            headers: row.headers || {},
          });
          sentIds.push(row.id);
        } catch (err) {
          this.logger.error(`Failed to relay outbox event ${row.id}: ${(err as Error).message}`);
          // leave as PENDING; next poll will retry
        }
      }

      await this.outboxService.markSent(sentIds);
    } catch (err) {
      this.logger.error(`Outbox relay error: ${(err as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
