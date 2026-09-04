import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from '../notification/notification.service.js';
import { ProcessedEventRepository } from '../../database/repositories/processed-event.repository.js';
import { NotificationKind } from '../../database/entities/notification-delivery.entity.js';

interface DomainEvent {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  timestamp?: string;
}

@Injectable()
export class KafkaEventProcessor {
  private readonly logger = new Logger(KafkaEventProcessor.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly processedEventRepo: ProcessedEventRepository,
  ) {}

  async process(
    rawValue: string,
    meta: { topic: string; partition: number; headers?: Record<string, string> },
  ): Promise<void> {
    let event: DomainEvent;
    try {
      event = JSON.parse(rawValue) as DomainEvent;
    } catch {
      this.logger.error(
        `Malformed JSON on topic ${meta.topic}: ${rawValue.substring(0, 200)}`,
      );
      return;
    }

    const { eventId, eventType, payload: eventPayload } = event;

    if (!eventId || !eventType) {
      this.logger.warn(
        `Event missing eventId or eventType on topic ${meta.topic}`,
      );
      return;
    }

    const correlationId = meta.headers?.['correlationId'];

    const alreadyProcessed =
      await this.processedEventRepo.existsByEventIdAndType(eventId, eventType);
    if (alreadyProcessed) {
      this.logger.debug(
        `Event ${eventType} (${eventId}) already processed – skipping`,
      );
      return;
    }

    try {
      switch (eventType) {
        case 'OrderConfirmed':
          await this.onOrderConfirmed(
            eventId,
            eventType,
            eventPayload,
            correlationId,
          );
          break;

        case 'OrderCancelled':
          await this.onOrderCancelled(
            eventId,
            eventType,
            eventPayload,
            correlationId,
          );
          break;

        case 'InventoryReservationFailed':
          await this.onInventoryReservationFailed(
            eventId,
            eventType,
            eventPayload,
            correlationId,
          );
          break;

        default:
          this.logger.debug(
            `Unhandled event type "${eventType}" – ignoring`,
          );
          return;
      }

      await this.processedEventRepo.markProcessed(
        eventId,
        eventType,
        correlationId,
      );
      this.logger.log(`Processed event ${eventType} (${eventId})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Error handling event ${eventType} (${eventId}): ${msg}`,
      );
    }
  }

  private async onOrderConfirmed(
    eventId: string,
    eventType: string,
    payload: Record<string, unknown>,
    correlationId?: string,
  ): Promise<void> {
    const recipientEmail =
      (payload['recipientEmail'] as string) ?? 'customer@example.com';
    const orderId = (payload['orderId'] as string) ?? 'unknown';

    await this.notificationService.createAndDispatch(
      {
        kind: NotificationKind.EMAIL,
        recipient: recipientEmail,
        channel: 'email',
        subject: `Order ${orderId} Confirmed`,
        body: `Your order ${orderId} has been confirmed. Thank you for your purchase!`,
      },
      { eventId, eventType, correlationId },
    );
  }

  private async onOrderCancelled(
    eventId: string,
    eventType: string,
    payload: Record<string, unknown>,
    correlationId?: string,
  ): Promise<void> {
    const recipientEmail =
      (payload['recipientEmail'] as string) ?? 'customer@example.com';
    const orderId = (payload['orderId'] as string) ?? 'unknown';
    const reason = (payload['reason'] as string) ?? '';

    const body = [
      `Your order ${orderId} has been cancelled.`,
      reason ? `Reason: ${reason}` : '',
      'If you were charged, a refund will be processed shortly.',
    ]
      .filter(Boolean)
      .join(' ');

    await this.notificationService.createAndDispatch(
      {
        kind: NotificationKind.EMAIL,
        recipient: recipientEmail,
        channel: 'email',
        subject: `Order ${orderId} Cancelled`,
        body,
      },
      { eventId, eventType, correlationId },
    );
  }

  private async onInventoryReservationFailed(
    eventId: string,
    eventType: string,
    payload: Record<string, unknown>,
    correlationId?: string,
  ): Promise<void> {
    const recipientEmail =
      (payload['recipientEmail'] as string) ?? 'customer@example.com';
    const orderId = (payload['orderId'] as string) ?? 'unknown';

    await this.notificationService.createAndDispatch(
      {
        kind: NotificationKind.EMAIL,
        recipient: recipientEmail,
        channel: 'email',
        subject: `Order ${orderId} Could Not Be Completed`,
        body: `We're sorry, but we could not complete your order ${orderId} due to inventory issues. Your payment has been refunded.`,
      },
      { eventId, eventType, correlationId },
    );
  }
}
