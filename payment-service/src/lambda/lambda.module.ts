import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment, LedgerEntry, Outbox, ProcessedEvent } from '../database/entities/index.js';
import { PaymentsService } from '../modules/payment/payments.service.js';
import { OutboxService } from '../modules/outbox/outbox.service.js';
import { KafkaEventProcessor } from '../modules/kafka/kafka-event.processor.service.js';
import { PaymentProviderStrategy } from '../modules/payment/strategies/payment-provider.strategy.js';
import { MockPaymentProviderStrategy } from '../modules/payment/strategies/mock-payment-provider.strategy.js';
import { StripePaymentProviderStrategy } from '../modules/payment/strategies/stripe-payment-provider.strategy.js';
import appConfig, { appConfigValidation } from '../config/app.config.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validationSchema: appConfigValidation,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('app.db.host'),
        port: config.get<number>('app.db.port'),
        username: config.get<string>('app.db.user'),
        password: config.get<string>('app.db.password'),
        database: config.get<string>('app.db.name'),
        entities: [Payment, LedgerEntry, Outbox, ProcessedEvent],
        synchronize: false,
        logging: config.get<string>('app.nodeEnv') === 'development',
      }),
    }),
    TypeOrmModule.forFeature([Payment, LedgerEntry, Outbox]),
  ],
  providers: [
    {
      provide: PaymentProviderStrategy,
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('app.payment.provider');
        return provider === 'stripe'
          ? new StripePaymentProviderStrategy(config)
          : new MockPaymentProviderStrategy();
      },
      inject: [ConfigService],
    },
    PaymentsService,
    OutboxService,
    KafkaEventProcessor,
  ],
  exports: [PaymentsService, KafkaEventProcessor],
})
export class LambdaContextModule {}
