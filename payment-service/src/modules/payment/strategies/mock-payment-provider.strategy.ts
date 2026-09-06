import { Injectable, Logger } from '@nestjs/common';
import { PaymentProviderStrategy, ChargeResult } from './payment-provider.strategy.js';
import { v4 as uuid } from 'uuid';

/**
 * Mock payment provider for local development & tests.
 * Always succeeds. Replace with Stripe / Adyen / etc. in production.
 */
@Injectable()
export class MockPaymentProviderStrategy extends PaymentProviderStrategy {
  private readonly logger = new Logger(MockPaymentProviderStrategy.name);

  async charge(params: {
    amount: number;
    currency: string;
    cardToken: string;
    idempotencyKey: string;
  }): Promise<ChargeResult> {
    this.logger.log(
      `Mock charge: ${params.amount} ${params.currency} (key=${params.idempotencyKey})`,
    );
    return {
      success: true,
      providerTransactionId: `mock_txn_${uuid()}`,
      provider: 'mock-provider',
    };
  }

  async refund(params: {
    providerTransactionId: string;
    amount: number;
    idempotencyKey: string;
  }): Promise<ChargeResult> {
    this.logger.log(`Mock refund: ${params.amount} on txn ${params.providerTransactionId}`);
    return {
      success: true,
      providerTransactionId: params.providerTransactionId,
      provider: 'mock-provider',
    };
  }
}
