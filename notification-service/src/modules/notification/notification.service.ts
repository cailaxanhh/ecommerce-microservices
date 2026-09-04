import {
  Injectable,
  NotFoundException,
  Logger,
  Inject,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  NotificationDelivery,
  NotificationStatus,
} from '../../database/entities/notification-delivery.entity.js';
import { NotificationDeliveryRepository } from '../../database/repositories/notification-delivery.repository.js';
import { NotificationDispatcher } from '../kafka/dispatcher/notification-dispatcher.interface.js';
import type { NotificationDispatcherImpl } from '../kafka/dispatcher/notification-dispatcher.interface.js';
import { CreateNotificationDto } from './dto/create-notification.dto.js';
import { ListNotificationsDto } from './dto/list-notifications.dto.js';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly repo: NotificationDeliveryRepository,
    @Inject(NotificationDispatcher)
    private readonly dispatcher: NotificationDispatcherImpl,
  ) {}

  /**
   * Create a PENDING delivery record and immediately attempt dispatch.
   */
  async createAndDispatch(
    dto: CreateNotificationDto,
    meta?: {
      eventId?: string;
      eventType?: string;
      correlationId?: string;
    },
  ): Promise<NotificationDelivery> {
    const record = this.repo.create({
      kind: dto.kind,
      recipient: dto.recipient,
      channel: dto.channel,
      subject: dto.subject ?? null,
      body: dto.body,
      status: NotificationStatus.PENDING,
      eventId: meta?.eventId ?? null,
      eventType: meta?.eventType ?? null,
      correlationId: meta?.correlationId ?? null,
    });

    const saved = await this.repo.save(record);
    this.logger.log(`Created notification delivery ${saved.id} (${saved.kind})`);

    // Dispatch in background – errors caught internally
    this.dispatchOne(saved).catch((err) =>
      this.logger.error(`Unhandled dispatch error for ${saved.id}: ${err.message}`),
    );

    return saved;
  }

  /**
   * Look up a single delivery record.
   */
  async findOne(id: string): Promise<NotificationDelivery> {
    const record = await this.repo.findById(id);
    if (!record) {
      throw new NotFoundException(`Notification delivery ${id} not found`);
    }
    return record;
  }

  /**
   * Paginated listing of delivery records.
   */
  async findAll(params: ListNotificationsDto): Promise<{
    data: NotificationDelivery[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { data, total } = await this.repo.findAll(params);
    return { data, total, page: params.page, limit: params.limit };
  }

  /**
   * Dispatch a single delivery record through the configured provider.
   */
  private async dispatchOne(record: NotificationDelivery): Promise<void> {
    try {
      const result = await this.dispatcher.dispatch({
        kind: record.kind,
        recipient: record.recipient,
        subject: record.subject,
        body: record.body,
        channel: record.channel,
      });

      if (result.success) {
        record.status = NotificationStatus.SENT;
        record.providerToken = result.providerToken ?? null;
        record.sentAt = new Date();
      } else {
        record.status = NotificationStatus.FAILED;
        record.errorMessage = result.errorMessage ?? 'Dispatch failed';
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      record.status = NotificationStatus.FAILED;
      record.errorMessage = message;
      this.logger.error(`Dispatch failed for ${record.id}: ${message}`);
    }

    await this.repo.save(record);
  }

  /**
   * Retry any PENDING deliveries that are stale (older than 5 min).
   * Runs every 60 seconds.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async retryPendingDeliveries(): Promise<void> {
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);

    const pending = await this.repo.find({
      where: {
        status: NotificationStatus.PENDING,
      },
      order: { createdAt: 'ASC' },
      take: 50,
    });

    const stale = pending.filter((p) => p.createdAt < staleThreshold);
    if (stale.length === 0) return;

    this.logger.log(`Retrying ${stale.length} stale PENDING deliveries`);
    for (const record of stale) {
      await this.dispatchOne(record);
    }
  }
}
