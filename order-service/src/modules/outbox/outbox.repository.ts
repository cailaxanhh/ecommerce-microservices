import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { Outbox, OutboxStatus } from '../../database/entities/outbox.entity.js';

@Injectable()
export class OutboxRepository {
  constructor(
    @InjectRepository(Outbox) private readonly repo: Repository<Outbox>,
  ) {}

  async createEntry(
    data: {
      aggregateId: string;
      eventType: string;
      payload: Record<string, unknown>;
      headers?: Record<string, unknown> | null;
    },
    queryRunner?: QueryRunner,
  ): Promise<Outbox> {
    const entry = this.repo.create({
      id: uuidv4(),
      aggregateId: data.aggregateId,
      eventType: data.eventType,
      eventId: uuidv4(),
      payload: data.payload,
      headers: data.headers ?? null,
      status: OutboxStatus.PENDING,
    });

    if (queryRunner) {
      return queryRunner.manager.save(Outbox, entry);
    }

    return this.repo.save(entry);
  }

  async fetchPending(
    limit: number,
    queryRunner?: QueryRunner,
  ): Promise<Outbox[]> {
    if (queryRunner) {
      return queryRunner.manager
        .createQueryBuilder(Outbox, 'outbox')
        .setLock('pessimistic_write')
        .where('outbox.status = :status', { status: OutboxStatus.PENDING })
        .orderBy('outbox.created_at', 'ASC')
        .take(limit)
        .getMany();
    }

    return this.repo
      .createQueryBuilder('outbox')
      .setLock('pessimistic_write')
      .where('outbox.status = :status', { status: OutboxStatus.PENDING })
      .orderBy('outbox.created_at', 'ASC')
      .take(limit)
      .getMany();
  }

  /**
   * Mark outbox entry as sent.
   */
  async markSent(id: string, queryRunner?: QueryRunner): Promise<void> {
    const manager = queryRunner ? queryRunner.manager : this.repo;

    await manager.update(Outbox, id, {
      status: OutboxStatus.SENT,
      processedAt: new Date(),
    });
  }

  /**
   * Reset a failed entry back to PENDING for retry.
   */
  async markFailed(id: string, queryRunner?: QueryRunner): Promise<void> {
    const manager = queryRunner ? queryRunner.manager : this.repo;

    // Leave status as PENDING so it will be retried on next poll cycle
    await manager.update(Outbox, id, {
      processedAt: null,
    });
  }
}
