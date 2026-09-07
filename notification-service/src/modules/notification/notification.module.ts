import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerModule, MailerService } from '@nestjs-modules/mailer';
import { NotificationDelivery } from '../../database/entities/notification-delivery.entity.js';
import { ProcessedEvent } from '../../database/entities/processed-event.entity.js';
import { NotificationDeliveryRepository } from '../../database/repositories/notification-delivery.repository.js';
import { ProcessedEventRepository } from '../../database/repositories/processed-event.repository.js';
import { NotificationService } from './notification.service.js';
import { NotificationController } from './notification.controller.js';
import { StubDispatcher } from '../kafka/dispatcher/stub-dispatcher.service.js';
import { SmtpDispatcher } from '../kafka/dispatcher/smtp-dispatcher.service.js';
import { NotificationDispatcher } from '../kafka/dispatcher/notification-dispatcher.interface.js';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../../common/auth/auth.module.js';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([NotificationDelivery, ProcessedEvent]),
    MailerModule.forRootAsync({
      imports: [],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const user = config.get<string>('SMTP_USER', '');
        const pass = config.get<string>('SMTP_PASSWORD', '');
        return {
          transport: {
            host: config.get<string>('SMTP_HOST', ''),
            port: config.get<number>('SMTP_PORT', 587),
            secure: config.get<string>('SMTP_SECURE', 'false') === 'true',
            auth: user ? { user, pass } : undefined,
          },
          defaults: {
            from: config.get<string>('SMTP_FROM', ''),
          },
        };
      },
    }),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationDeliveryRepository,
    ProcessedEventRepository,
    NotificationService,
    {
      provide: NotificationDispatcher,
      useFactory: (config: ConfigService, mailer: MailerService) => {
        const mode = config.get<string>('DISPATCH_MODE', 'stub');
        switch (mode) {
          case 'smtp':
            return new SmtpDispatcher(mailer);
          case 'stub':
          default:
            return new StubDispatcher();
        }
      },
      inject: [ConfigService, MailerService],
    },
  ],
  exports: [NotificationService, NotificationDeliveryRepository, ProcessedEventRepository],
})
export class NotificationModule {}
