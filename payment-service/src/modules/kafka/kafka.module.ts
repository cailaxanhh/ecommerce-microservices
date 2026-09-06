import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KafkaProducerService } from './kafka-producer.service.js';
import { KafkaConsumerService } from './kafka-consumer.service.js';
import { KafkaEventProcessor } from './kafka-event.processor.service.js';
import { PaymentsModule } from '../payment/payments.module.js';
import { AppConfig } from '../../config/app.config.js';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: config.get('app.kafka.clientId')!,
              brokers: config.get('app.kafka.brokers')!,
            },
            consumer: {
              groupId: `${config.get('app.kafka.clientId')}-group`,
            },
          },
        }),
      },
    ]),
    PaymentsModule,
  ],
  providers: [KafkaProducerService, KafkaConsumerService, KafkaEventProcessor],
  exports: [KafkaProducerService],
})
export class KafkaModule {}
