import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Outbox } from '../../database/entities/outbox.entity.js';
import { OutboxRepository } from './outbox.repository.js';
import { OutboxService } from './outbox.service.js';
import { KafkaModule } from '../kafka/kafka.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Outbox]), KafkaModule],
  providers: [OutboxRepository, OutboxService],
  exports: [OutboxRepository],
})
export class OutboxModule {}
