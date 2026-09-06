import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { AppConfig } from '../../config/app.config.js';
import { PaymentsService } from '../payment/payments.service.js';
import {
  OrderCreatedEvent,
  RefundRequiredEvent,
  InventoryReservationFailedEvent,
} from './kafka-consumer.service.js';

@Injectable()
export class KafkaEventProcessor {
  private readonly logger = new Logger(KafkaEventProcessor.name);
  private readonly redis: Redis;

  constructor(
    private readonly config: ConfigService,
    private readonly paymentsService: PaymentsService,
  ) {
    this.redis = new Redis({
      host: this.config.get('app.redis.host'),
      port: this.config.get('app.redis.port'),
    });
  }

  async process(
    rawValue: string,
    meta: {
      topic: string;
      partition: string;
      traceId?: string;
      headers?: Record<string, string>;
    },
  ): Promise<void> {
    const { topic, partition, headers } = meta;
    const offset = partition;

    const parsed = JSON.parse(rawValue);
    const eventType = headers?.eventType || parsed.eventType;
    const eventId = headers?.eventId || parsed.eventId || `${topic}-${partition}-${offset}`;

    const dedupKey = `dedup:${topic}:${eventId}`;
    const alreadyProcessed = await this.redis.set(dedupKey, '1', 'EX', 86400, 'NX');
    if (!alreadyProcessed) {
      this.logger.debug(`Skipping duplicate event ${eventId}`);
      return;
    }

    this.logger.log(`Received ${eventType} from ${topic} (offset=${offset})`);

    switch (eventType) {
      case 'OrderCreated': {
        const data: OrderCreatedEvent = parsed.payload ?? parsed;
        await this.paymentsService.processOrderCreated(data, {
          correlationId: headers?.correlationId || eventId,
        });
        break;
      }
      case 'RefundRequired': {
        const data: RefundRequiredEvent = parsed.payload ?? parsed;
        await this.paymentsService.processRefundRequired(data, {
          correlationId: headers?.correlationId || eventId,
        });
        break;
      }
      case 'InventoryReservationFailed': {
        const data: InventoryReservationFailedEvent = parsed.payload ?? parsed;
        await this.paymentsService.processInventoryReservationFailed(data, {
          correlationId: headers?.correlationId || eventId,
        });
        break;
      }
      default:
        this.logger.warn(`Unknown event type on ${topic}: ${eventType}`);
    }
  }
}
