import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientKafka, MessagePattern, Payload, KafkaContext, Ctx } from '@nestjs/microservices';
import { AppConfig } from '../../config/app.config.js';
import { KafkaEventProcessor } from './kafka-event.processor.service.js';

/**
 * Incoming event envelopes from Kafka topics.
 */
export interface OrderCreatedEvent {
  eventType: 'OrderCreated';
  orderId: string;
  customerUserId: string;
  amount: number;
  currency: string;
  cardToken: string;
  idempotencyKey: string;
}

export interface RefundRequiredEvent {
  eventType: 'RefundRequired';
  orderId: string;
  paymentId: string;
  amount: number;
  reason: string;
}

export interface InventoryReservationFailedEvent {
  eventType: 'InventoryReservationFailed';
  orderId: string;
  paymentId: string;
}

export type OrderEvent = OrderCreatedEvent;
export type PaymentEvent = RefundRequiredEvent | InventoryReservationFailedEvent;

@Injectable()
export class KafkaConsumerService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);

  constructor(
    private readonly client: ClientKafka,
    private readonly config: ConfigService,
    private readonly processor: KafkaEventProcessor,
  ) {}

  async onModuleInit(): Promise<void> {
    const orderTopic = this.config.get('app.kafka.orderTopic')!;
    const paymentTopic = this.config.get('app.kafka.paymentTopic')!;

    await this.client.subscribeToResponseOf(orderTopic);
    await this.client.subscribeToResponseOf(paymentTopic);
    await this.client.connect();

    this.logger.log(`Kafka consumer subscribed to [${orderTopic}, ${paymentTopic}]`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  // ─── Order topic: OrderCreated ────────────────────────────────

  @MessagePattern('order-events')
  async handleOrderEvent(
    @Payload() message: { value: string; headers: Record<string, Buffer> },
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    const topic = context.getTopic();
    const partition = context.getPartition();

    const headers: Record<string, string> = {};
    if (message.headers) {
      for (const [key, val] of Object.entries(message.headers)) {
        headers[key] = Buffer.isBuffer(val) ? val.toString('utf8') : String(val);
      }
    }

    await this.processor.process(message.value, {
      topic,
      partition: String(partition),
      headers,
    });
  }

  // ─── Payment topic: RefundRequired / InventoryReservationFailed ──

  @MessagePattern('payment-events')
  async handlePaymentEvent(
    @Payload() message: { value: string; headers: Record<string, Buffer> },
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    const topic = context.getTopic();
    const partition = context.getPartition();

    const headers: Record<string, string> = {};
    if (message.headers) {
      for (const [key, val] of Object.entries(message.headers)) {
        headers[key] = Buffer.isBuffer(val) ? val.toString('utf8') : String(val);
      }
    }

    await this.processor.process(message.value, {
      topic,
      partition: String(partition),
      headers,
    });
  }
}
