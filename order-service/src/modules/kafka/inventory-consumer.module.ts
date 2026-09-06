import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaConsumerService } from './kafka-consumer.service.js';
import { InventoryEventProcessor } from './inventory-event.processor.service.js';
import { ProcessedEvent } from '../../database/entities/processed-event.entity.js';
import { OrderModule } from '../order/order.module.js';
import { OutboxModule } from '../outbox/outbox.module.js';

/**
 * Module that hosts the Kafka consumer for inventory events.
 * Separate from KafkaModule (producer) to avoid circular dependencies.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ProcessedEvent]), OrderModule, OutboxModule],
  providers: [InventoryEventProcessor, KafkaConsumerService],
})
export class InventoryConsumerModule {}
