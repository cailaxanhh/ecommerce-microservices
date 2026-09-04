import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationDelivery } from '../../database/entities/notification-delivery.entity.js';
import { ProcessedEvent } from '../../database/entities/processed-event.entity.js';
import { NotificationDeliveryRepository } from '../../database/repositories/notification-delivery.repository.js';
import { ProcessedEventRepository } from '../../database/repositories/processed-event.repository.js';
import { NotificationService } from './notification.service.js';
import { NotificationController } from './notification.controller.js';
import { StubDispatcher } from '../kafka/dispatcher/stub-dispatcher.service.js';
import { NotificationDispatcher } from '../kafka/dispatcher/notification-dispatcher.interface.js';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationDelivery, ProcessedEvent]),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationDeliveryRepository,
    ProcessedEventRepository,
    NotificationService,
    {
      provide: NotificationDispatcher,
      useFactory: (config: ConfigService) => {
        const mode = config.get<string>('DISPATCH_MODE', 'stub');
        // Future: switch on mode to provide SmtpDispatcher, etc.
        switch (mode) {
          case 'smtp':
            // Intentionally fall-through to stub until SMTP dispatcher is implemented
          case 'stub':
          default:
            return new StubDispatcher();
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: [NotificationService, NotificationDeliveryRepository, ProcessedEventRepository],
})
export class NotificationModule {}
