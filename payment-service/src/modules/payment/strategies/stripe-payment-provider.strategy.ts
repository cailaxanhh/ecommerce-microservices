import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentProviderStrategy, ChargeResult } from './payment-provider.strategy.js';

const SUCCEEDED_STATUSES = new Set<string>(['succeeded', 'processing']);

/**
 * Stripe payment provider strategy.
 * Charges are created synchronously via PaymentIntents (confirm on create),
 * refunds are issued via the Refunds API. Amounts are converted to the
 * smallest currency unit (cents) as required by the Stripe API.
 */
@Injectable()
export class StripePaymentProviderStrategy extends PaymentProviderStrategy {
  private readonly logger = new Logger(StripePaymentProviderStrategy.name);
  private readonly stripe: Stripe;

  constructor(configService: ConfigService) {
    super();
    const secretKey = configService.get<string>('app.payment.stripeSecretKey');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is required when PAYMENT_PROVIDER=stripe');
    }
    this.stripe = new Stripe(secretKey);
  }

  async charge(params: {
    amount: number;
    currency: string;
    cardToken: string;
    idempotencyKey: string;
  }): Promise<ChargeResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create(
        {
          amount: Math.round(params.amount * 100),
          currency: params.currency.toLowerCase(),
          payment_method: params.cardToken,
          confirm: true,
          metadata: { idempotencyKey: params.idempotencyKey },
        },
        { idempotencyKey: params.idempotencyKey },
      );

      if (SUCCEEDED_STATUSES.has(paymentIntent.status)) {
        return {
          success: true,
          providerTransactionId: paymentIntent.id,
          provider: 'stripe',
        };
      }

      this.logger.warn(
        `Stripe payment intent ${paymentIntent.id} not succeeded: ${paymentIntent.status}`,
      );
      return {
        success: false,
        providerTransactionId: paymentIntent.id,
        provider: 'stripe',
        message: `Payment requires additional action (${paymentIntent.status})`,
      };
    } catch (error) {
      this.logger.error({ error }, 'Stripe charge failed');
      return {
        success: false,
        providerTransactionId: '',
        provider: 'stripe',
        message:
          error instanceof Stripe.errors.StripeCardError ? error.message : 'Stripe charge failed',
      };
    }
  }

  async refund(params: {
    providerTransactionId: string;
    amount: number;
    idempotencyKey: string;
  }): Promise<ChargeResult> {
    try {
      const refund = await this.stripe.refunds.create(
        {
          payment_intent: params.providerTransactionId,
          amount: Math.round(params.amount * 100),
          metadata: { idempotencyKey: params.idempotencyKey },
        },
        { idempotencyKey: params.idempotencyKey },
      );

      if (refund.status === 'failed') {
        this.logger.warn(`Stripe refund ${refund.id} failed for ${params.providerTransactionId}`);
        return {
          success: false,
          providerTransactionId: refund.payment_intent?.toString() ?? params.providerTransactionId,
          provider: 'stripe',
          message: refund.failure_reason || 'Stripe refund failed',
        };
      }

      return {
        success: true,
        providerTransactionId: refund.payment_intent?.toString() ?? params.providerTransactionId,
        provider: 'stripe',
      };
    } catch (error) {
      this.logger.error({ error }, 'Stripe refund failed');
      return {
        success: false,
        providerTransactionId: params.providerTransactionId,
        provider: 'stripe',
        message:
          error instanceof Stripe.errors.StripeCardError ? error.message : 'Stripe refund failed',
      };
    }
  }
}
