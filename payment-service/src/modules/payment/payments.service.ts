import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import {
  Payment,
  PaymentStatus,
  LedgerEntry,
  LedgerEntryType,
  Outbox,
  OutboxEventType,
} from '../../database/entities/index.js';
import { PaymentProviderStrategy } from './strategies/payment-provider.strategy.js';
import { OutboxService } from '../outbox/outbox.service.js';
import {
  OrderCreatedEvent,
  RefundRequiredEvent,
  InventoryReservationFailedEvent,
} from '../kafka/kafka-consumer.service.js';

interface TxContext {
  correlationId: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    private readonly dataSource: DataSource,
    private readonly paymentProvider: PaymentProviderStrategy,
    private readonly outboxService: OutboxService,
  ) {}

  // ─── REST: Sync charge endpoint ────────────────────────────────

  /**
   * Create and execute a payment charge.
   * Wrapped in a single DB transaction: Payment + Ledger + Outbox rows.
   */
  async charge(params: {
    orderId: string;
    customerUserId: string;
    amount: number;
    currency: string;
    cardToken: string;
    idempotencyKey?: string;
    correlationId?: string;
  }): Promise<Payment> {
    const idempotencyKey = params.idempotencyKey || `pay_${params.orderId}_${Date.now()}`;

    // ── Idempotency check: look up existing payment by orderId or idempotencyKey ──
    const existing = await this.paymentRepo.findOne({
      where: [{ orderId: params.orderId }, { idempotencyKey }],
    });
    if (existing) {
      this.logger.log(`Payment already exists for orderId=${params.orderId}, returning existing`);
      return existing;
    }

    const paymentId = uuid();
    const eventId = uuid();
    const ledgerId = uuid();

    // ── Call payment provider ──
    const chargeResult = await this.paymentProvider.charge({
      amount: params.amount,
      currency: params.currency || 'USD',
      cardToken: params.cardToken,
      idempotencyKey: params.orderId, // PSP-level idempotency keyed by orderId
    });

    const finalStatus = chargeResult.success ? PaymentStatus.PROCESSED : PaymentStatus.FAILED;

    const outboxEventType = chargeResult.success
      ? OutboxEventType.PAYMENT_SUCCEEDED
      : OutboxEventType.PAYMENT_FAILED;

    // ── Atomic write: Payment + Ledger + Outbox in one transaction ──
    const payment = await this.dataSource.transaction(async (tm) => {
      const pay = tm.create(Payment, {
        id: paymentId,
        orderId: params.orderId,
        customerUserId: params.customerUserId,
        amount: params.amount,
        currency: params.currency || 'USD',
        status: finalStatus,
        method: 'CARD' as any,
        provider: chargeResult.provider,
        providerTransactionId: chargeResult.providerTransactionId,
        idempotencyKey,
        refundedAmount: 0,
      });
      await tm.save(pay);

      const ledger = tm.create(LedgerEntry, {
        id: ledgerId,
        paymentId,
        type: LedgerEntryType.CHARGE,
        amount: params.amount,
        reason: chargeResult.success ? null : chargeResult.message || 'Charge failed',
      });
      await tm.save(ledger);

      // Outbox row – will be relayed by OutboxRelayService
      await this.outboxService.append({
        aggregateId: paymentId,
        eventType: outboxEventType,
        eventId,
        payload: {
          paymentId,
          orderId: params.orderId,
          customerUserId: params.customerUserId,
          amount: params.amount,
          currency: params.currency || 'USD',
          status: finalStatus,
          providerTransactionId: chargeResult.providerTransactionId,
          provider: chargeResult.provider,
        },
        headers: {
          correlationId: params.correlationId || eventId,
        },
      });

      return pay;
    });

    this.logger.log(`Charge ${finalStatus}: paymentId=${paymentId} orderId=${params.orderId}`);

    return payment;
  }

  // ─── Kafka: OrderCreated handler ───────────────────────────────

  async processOrderCreated(event: OrderCreatedEvent, ctx: TxContext): Promise<void> {
    this.logger.log(
      `Processing OrderCreated for orderId=${event.orderId} (correlationId=${ctx.correlationId})`,
    );

    await this.charge({
      orderId: event.orderId,
      customerUserId: event.customerUserId,
      amount: event.amount,
      currency: event.currency,
      cardToken: event.cardToken,
      idempotencyKey: event.idempotencyKey,
      correlationId: ctx.correlationId,
    });
  }

  // ─── Kafka: RefundRequired handler ─────────────────────────────

  async processRefundRequired(event: RefundRequiredEvent, ctx: TxContext): Promise<void> {
    this.logger.log(
      `Processing RefundRequired for orderId=${event.orderId} (correlationId=${ctx.correlationId})`,
    );

    await this.executeRefund({
      paymentId: event.paymentId,
      amount: event.amount,
      reason: event.reason,
      correlationId: ctx.correlationId,
    });
  }

  // ─── Kafka: InventoryReservationFailed handler ─────────────────

  async processInventoryReservationFailed(
    event: InventoryReservationFailedEvent,
    ctx: TxContext,
  ): Promise<void> {
    this.logger.log(
      `Processing InventoryReservationFailed for orderId=${event.orderId} — issuing refund`,
    );

    // Find the payment for this order and refund it
    const payment = await this.paymentRepo.findOne({
      where: { orderId: event.orderId },
    });
    if (!payment) {
      this.logger.warn(`No payment found for orderId=${event.orderId} — skipping refund`);
      return;
    }

    await this.executeRefund({
      paymentId: payment.id,
      amount: Number(payment.amount) - Number(payment.refundedAmount),
      reason: 'Inventory reservation failed — saga compensation',
      correlationId: ctx.correlationId,
    });
  }

  // ─── REST: Refund endpoint ─────────────────────────────────────

  async requestRefund(params: {
    paymentId: string;
    amount?: number;
    reason?: string;
    correlationId?: string;
  }): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({
      where: { id: params.paymentId },
    });
    if (!payment) {
      throw new NotFoundException(`Payment ${params.paymentId} not found`);
    }

    if (
      payment.status !== PaymentStatus.PROCESSED &&
      payment.status !== PaymentStatus.PARTIALLY_REFUNDED
    ) {
      throw new BadRequestException(`Payment in status ${payment.status} cannot be refunded`);
    }

    const refundAmount = params.amount ?? Number(payment.amount) - Number(payment.refundedAmount);

    if (refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be positive');
    }

    if (refundAmount > Number(payment.amount) - Number(payment.refundedAmount)) {
      throw new BadRequestException(
        `Refund amount ${refundAmount} exceeds available ${Number(payment.amount) - Number(payment.refundedAmount)}`,
      );
    }

    return this.executeRefund({
      paymentId: params.paymentId,
      amount: refundAmount,
      reason: params.reason || 'Customer requested refund',
      correlationId: params.correlationId,
    });
  }

  // ─── Internal: execute refund ──────────────────────────────────

  private async executeRefund(params: {
    paymentId: string;
    amount: number;
    reason: string;
    correlationId?: string;
  }): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({
      where: { id: params.paymentId },
    });
    if (!payment) {
      throw new NotFoundException(`Payment ${params.paymentId} not found`);
    }

    if (!payment.providerTransactionId) {
      throw new BadRequestException('Payment has no provider transaction to refund');
    }

    const eventId = uuid();
    const refundIdempotencyKey = `refund_${payment.id}_${Date.now()}`;

    const refundResult = await this.paymentProvider.refund({
      providerTransactionId: payment.providerTransactionId,
      amount: params.amount,
      idempotencyKey: refundIdempotencyKey,
    });

    if (!refundResult.success) {
      this.logger.error(`Refund failed for paymentId=${params.paymentId}: ${refundResult.message}`);
      throw new BadRequestException(`Refund failed: ${refundResult.message || 'Provider error'}`);
    }

    const newRefundedAmount = Number(payment.refundedAmount) + params.amount;
    const isFullRefund = newRefundedAmount >= Number(payment.amount);
    const newStatus = isFullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;

    // Atomic: update payment + ledger + outbox
    const updated = await this.dataSource.transaction(async (tm) => {
      await tm.update(Payment, payment.id, {
        refundedAmount: newRefundedAmount,
        status: newStatus,
      });

      const ledger = tm.create(LedgerEntry, {
        paymentId: payment.id,
        type: LedgerEntryType.REFUND,
        amount: params.amount,
        reason: params.reason,
      });
      await tm.save(ledger);

      await this.outboxService.append({
        aggregateId: payment.id,
        eventType: OutboxEventType.REFUND_ISSUED,
        eventId,
        payload: {
          paymentId: payment.id,
          orderId: payment.orderId,
          customerUserId: payment.customerUserId,
          refundAmount: params.amount,
          refundedAmount: newRefundedAmount,
          isFullRefund,
          status: newStatus,
          reason: params.reason,
          providerTransactionId: payment.providerTransactionId,
        },
        headers: {
          correlationId: params.correlationId || eventId,
        },
      });

      return tm.findOne(Payment, { where: { id: payment.id } });
    });

    this.logger.log(
      `Refund executed: paymentId=${payment.id} amount=${params.amount} status=${newStatus}`,
    );

    return updated!;
  }

  // ─── Query methods ─────────────────────────────────────────────

  async findById(id: string): Promise<Payment | null> {
    return this.paymentRepo.findOne({ where: { id } });
  }

  async findAll(params: {
    orderId?: string;
    customerUserId?: string;
    status?: PaymentStatus;
    page?: number;
    limit?: number;
  }): Promise<{ data: Payment[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 20;

    const qb = this.paymentRepo.createQueryBuilder('p');

    if (params.orderId) {
      qb.andWhere('p.orderId = :orderId', { orderId: params.orderId });
    }
    if (params.customerUserId) {
      qb.andWhere('p.customerUserId = :customerUserId', {
        customerUserId: params.customerUserId,
      });
    }
    if (params.status) {
      qb.andWhere('p.status = :status', { status: params.status });
    }

    qb.orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }
}
