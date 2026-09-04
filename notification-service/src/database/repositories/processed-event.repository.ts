import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessedEvent } from '../entities/processed-event.entity.js';

@Injectable()
export class ProcessedEventRepository extends Repository<ProcessedEvent> {
  constructor(
    @InjectRepository(ProcessedEvent)
    repo: Repository<ProcessedEvent>,
  ) {
    super(repo.target, repo.manager, repo.queryRunner);
  }

  async existsByEventIdAndType(
    eventId: string,
    eventType: string,
  ): Promise<boolean> {
    const count = await this.count({
      where: { eventId, eventType },
    });
    return count > 0;
  }

  async markProcessed(
    eventId: string,
    eventType: string,
    correlationId?: string,
  ): Promise<ProcessedEvent> {
    const record = this.create({ eventId, eventType, correlationId });
    return this.save(record);
  }
}
