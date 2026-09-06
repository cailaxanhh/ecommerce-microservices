import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Outbox } from '../../database/entities/index.js';
import { OutboxService } from './outbox.service.js';
import { OutboxRelayService } from './outbox-relay.service.js';
import { KafkaModule } from '../kafka/kafka.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Outbox]),
    ScheduleModule.forRoot(),
    KafkaModule,
  ],
  providers: [OutboxService, OutboxRelayService],
  exports: [OutboxService],
})
export class OutboxModule {}
