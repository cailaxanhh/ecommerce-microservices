import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IHeaders } from 'kafkajs';
import { ProcessedEvent } from '../../database/entities/processed-event.entity.js';
import { OrderRepository } from '../order/order.repository.js';
import { OutboxRepository } from '../outbox/outbox.repository.js';
import { OrderStatus } from '../order/enums/order-status.enum.js';
import { v4 as uuidv4 } from 'uuid';

export interface InventoryEventMeta {
  topic: string;
  partition: number;
}

interface InventoryReservedEvent {
  eventId: string;
  orderId: string;
  correlationId?: string;
  reservedItems: Array<{ productId: string; quantity: number }>;
  timestamp: string;
}

interface InventoryReservationFailedEvent {
  eventId: string;
  orderId: string;
  correlationId?: string;
  reason: string;
  failedItems: Array<{ productId: string; quantity: number }>;
  timestamp: string;
}

@Injectable()
export class InventoryEventProcessor {
  private readonly logger = new Logger(InventoryEventProcessor.name);
  private readonly idempotencyTtlMs: number;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(ProcessedEvent)
    private readonly processedEventRepo: Repository<ProcessedEvent>,
    private readonly orderRepository: OrderRepository,
    private readonly outboxRepository: OutboxRepository,
  ) {
    this.idempotencyTtlMs =
      this.configService.get<number>(
        'app.inventoryEventTtlMs',
        24 * 60 * 60 * 1000,
      ) || 24 * 60 * 60 * 1000;
  }

  async process(
    rawValue: string,
    meta: InventoryEventMeta,
    headers?: IHeaders,
  ): Promise<void> {
    const { topic, partition } = meta;

    try {
      const event = JSON.parse(rawValue) as Record<string, unknown>;
      const eventType = (event.eventType ||
        headers?.['event-type']?.toString()) as string;
      const eventId = (event.eventId ||
        headers?.['event-id']?.toString()) as string;

      if (!eventId) {
        this.logger.warn(
          { topic, partition },
          'Received event without eventId, skipping',
        );
        return;
      }

      if (await this.isEventProcessed(eventId)) {
        this.logger.debug(
          { eventId, eventType, topic, partition },
          'Event already processed, skipping',
        );
        return;
      }

      this.logger.debug(
        { eventId, eventType, topic, partition },
        'Processing inventory event',
      );

      switch (eventType) {
        case 'InventoryReserved':
          await this.handleInventoryReserved(
            event as unknown as InventoryReservedEvent,
          );
          break;
        case 'InventoryReservationFailed':
          await this.handleInventoryReservationFailed(
            event as unknown as InventoryReservationFailedEvent,
          );
          break;
        default:
          this.logger.warn(
            { eventType, eventId },
            'Unknown event type, ignoring',
          );
      }

      // Mark event as processed
      await this.markEventProcessed(eventId, eventType);
    } catch (error) {
      this.logger.error(
        { topic, partition, error },
        'Failed to process inventory event',
      );
    }
  }

  private async handleInventoryReserved(
    event: InventoryReservedEvent,
  ): Promise<void> {
    const { orderId, correlationId } = event;

    this.logger.log({ orderId }, 'Inventory reserved — confirming order');

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      this.logger.warn(
        { orderId },
        'Order not found for InventoryReserved event',
      );
      return;
    }

    if (order.status !== OrderStatus.PENDING) {
      this.logger.warn(
        { orderId, currentStatus: order.status },
        'Order is not PENDING, skipping confirmation',
      );
      return;
    }

    // Update order status to CONFIRMED
    await this.orderRepository.updateStatus(orderId, OrderStatus.CONFIRMED);

    await this.outboxRepository.createEntry({
      aggregateId: orderId,
      eventType: 'OrderConfirmed',
      payload: {
        eventType: 'OrderConfirmed',
        orderId,
        orderNumber: order.orderNumber,
        customerUserId: order.customerUserId,
        totalAmount: order.totalAmount,
        currency: order.currency,
        timestamp: new Date().toISOString(),
      },
      headers: {
        correlationId: correlationId || order.correlationId,
        eventId: uuidv4(),
      },
    });

    this.logger.log(
      { orderId },
      'Order confirmed and OrderConfirmed event queued',
    );
  }

  private async handleInventoryReservationFailed(
    event: InventoryReservationFailedEvent,
  ): Promise<void> {
    const { orderId, correlationId, reason } = event;

    this.logger.log(
      { orderId, reason },
      'Inventory reservation failed — cancelling order',
    );

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      this.logger.warn(
        { orderId },
        'Order not found for InventoryReservationFailed event',
      );
      return;
    }

    if (order.status !== OrderStatus.PENDING) {
      this.logger.warn(
        { orderId, currentStatus: order.status },
        'Order is not PENDING, skipping cancellation',
      );
      return;
    }

    // Update order status to CANCELLED
    await this.orderRepository.updateStatus(orderId, OrderStatus.CANCELLED);

    await this.outboxRepository.createEntry({
      aggregateId: orderId,
      eventType: 'OrderCancelled',
      payload: {
        eventType: 'OrderCancelled',
        orderId,
        orderNumber: order.orderNumber,
        customerUserId: order.customerUserId,
        reason: reason || 'Inventory reservation failed',
        timestamp: new Date().toISOString(),
      },
      headers: {
        correlationId: correlationId || order.correlationId,
        eventId: uuidv4(),
      },
    });

    this.logger.log(
      { orderId, reason },
      'Order cancelled and OrderCancelled event queued',
    );
  }

  private async isEventProcessed(eventId: string): Promise<boolean> {
    const found = await this.processedEventRepo.findOne({
      where: { eventId },
    });

    if (!found) {
      return false;
    }

    if (found.expiresAt < new Date()) {
      await this.processedEventRepo.remove(found);
      return false;
    }

    return true;
  }

  private async markEventProcessed(
    eventId: string,
    eventType: string,
  ): Promise<void> {
    const entry = this.processedEventRepo.create({
      eventId,
      eventType,
      expiresAt: new Date(Date.now() + this.idempotencyTtlMs),
    });

    try {
      await this.processedEventRepo.save(entry);
    } catch {
      this.logger.debug({ eventId }, 'Event already marked as processed');
    }
  }
}
