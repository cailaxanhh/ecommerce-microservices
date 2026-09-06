import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment, LedgerEntry } from '../../database/entities/index.js';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';
import { MockPaymentProviderStrategy } from './strategies/mock-payment-provider.strategy.js';
import { StripePaymentProviderStrategy } from './strategies/stripe-payment-provider.strategy.js';
import { PaymentProviderStrategy } from './strategies/payment-provider.strategy.js';
import { OutboxModule } from '../outbox/outbox.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, LedgerEntry]), OutboxModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PaymentProviderStrategy,
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<string>('app.payment.provider');
        return provider === 'stripe'
          ? new StripePaymentProviderStrategy(configService)
          : new MockPaymentProviderStrategy();
      },
      inject: [ConfigService],
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
