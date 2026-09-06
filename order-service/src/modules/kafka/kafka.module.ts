import { Module, Global } from '@nestjs/common';
import { KafkaProducerService } from './kafka-producer.service.js';

@Global()
@Module({
  providers: [KafkaProducerService],
  exports: [KafkaProducerService],
})
export class KafkaModule {}
