import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Outbox,
  OutboxStatus,
  OutboxEventType,
} from '../../database/entities/index.js';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    @InjectRepository(Outbox)
    private readonly outboxRepo: Repository<Outbox>,
  ) {}

  async append(params: {
    aggregateId: string;
    eventType: OutboxEventType;
    eventId: string;
    payload: Record<string, unknown>;
    headers?: Record<string, string>;
  }): Promise<Outbox> {
    const row = this.outboxRepo.create({
      aggregateId: params.aggregateId,
      eventType: params.eventType,
      eventId: params.eventId,
      payload: params.payload,
      headers: params.headers || null,
      status: OutboxStatus.PENDING,
    });
    return this.outboxRepo.save(row);
  }

  async fetchPending(batchSize = 50): Promise<Outbox[]> {
    return this.outboxRepo.manager.transaction(async (tm) => {
      const rows = await tm
        .createQueryBuilder(Outbox, 'o')
        .where('o.status = :status', { status: OutboxStatus.PENDING })
        .orderBy('o.createdAt', 'ASC')
        .limit(batchSize)
        .setLock('pessimistic_write')
        .getMany();
      return rows;
    });
  }

  async markSent(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.outboxRepo.update(ids, {
      status: OutboxStatus.SENT,
      processedAt: new Date(),
    });
  }
}
