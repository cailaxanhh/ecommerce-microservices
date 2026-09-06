export interface ChargeResult {
  success: boolean;
  providerTransactionId: string;
  provider: string;
  message?: string;
}

/**
 * Abstract payment provider strategy.
 * Implementations handle the actual card charge / refund with a PSP.
 */
export abstract class PaymentProviderStrategy {
  abstract charge(params: {
    amount: number;
    currency: string;
    cardToken: string;
    idempotencyKey: string;
  }): Promise<ChargeResult>;

  abstract refund(params: {
    providerTransactionId: string;
    amount: number;
    idempotencyKey: string;
  }): Promise<ChargeResult>;
}
