import { Module } from '@nestjs/common';
import { KafkaConsumerService } from './kafka-consumer.service.js';
import { KafkaEventProcessor } from './kafka-event.processor.service.js';
import { NotificationModule } from '../notification/notification.module.js';

@Module({
  imports: [NotificationModule],
  providers: [KafkaEventProcessor, KafkaConsumerService],
})
export class KafkaConsumerModule {}
