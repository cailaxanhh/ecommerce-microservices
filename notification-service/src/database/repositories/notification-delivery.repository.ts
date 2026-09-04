import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotificationDelivery,
  NotificationStatus,
} from '../entities/notification-delivery.entity.js';

@Injectable()
export class NotificationDeliveryRepository extends Repository<NotificationDelivery> {
  constructor(
    @InjectRepository(NotificationDelivery)
    repo: Repository<NotificationDelivery>,
  ) {
    super(repo.target, repo.manager, repo.queryRunner);
  }

  async findById(id: string): Promise<NotificationDelivery | null> {
    return this.findOne({ where: { id } });
  }

  async findByEventIdAndType(
    eventId: string,
    eventType: string,
  ): Promise<NotificationDelivery | null> {
    return this.findOne({ where: { eventId, eventType } });
  }

  async findAll(params: {
    page: number;
    limit: number;
    kind?: string;
    status?: NotificationStatus;
    recipientEmail?: string;
  }): Promise<{ data: NotificationDelivery[]; total: number }> {
    const { page, limit, kind, status, recipientEmail } = params;
    const qb = this.createQueryBuilder('nd');

    if (kind) {
      qb.andWhere('nd.kind = :kind', { kind });
    }
    if (status) {
      qb.andWhere('nd.status = :status', { status });
    }
    if (recipientEmail) {
      qb.andWhere('nd.recipient ILIKE :recipientEmail', {
        recipientEmail: `%${recipientEmail}%`,
      });
    }

    qb.orderBy('nd.createdAt', 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }
}
