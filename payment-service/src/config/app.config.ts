import { registerAs } from '@nestjs/config';
import Joi from 'joi';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
  };
  jwt: {
    secret: string;
  };
  redis: {
    host: string;
    port: number;
  };
  kafka: {
    brokers: string[];
    clientId: string;
    paymentTopic: string;
    orderTopic: string;
  };
  outbox: {
    pollIntervalMs: number;
  };
  payment: {
    provider: string;
    stripeSecretKey: string;
    stripeWebhookSecret: string;
  };
  refund: {
    approvalLimit: number;
    allowSingleApprover: boolean;
  };
  logLevel: string;
}

export const appConfigValidation = Joi.object({
  PORT: Joi.number().default(3004),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  INTERNAL_JWT_SECRET: Joi.string().min(8).required(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  KAFKA_BROKERS: Joi.string().required(),
  KAFKA_CLIENT_ID: Joi.string().default('payment-service'),
  PAYMENT_TOPIC: Joi.string().default('payment-events'),
  ORDER_TOPIC: Joi.string().default('order-events'),
  OUTBOX_POLL_INTERVAL_MS: Joi.number().default(2000),
  PAYMENT_PROVIDER: Joi.string().valid('mock', 'stripe').default('mock'),
  STRIPE_SECRET_KEY: Joi.string().when('PAYMENT_PROVIDER', {
    is: 'stripe',
    then: Joi.string().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  STRIPE_WEBHOOK_SECRET: Joi.string().allow('').optional(),
  REFUND_APPROVAL_LIMIT: Joi.number().default(500),
  ALLOW_SINGLE_APPROVER_REFUND: Joi.boolean().default(false),
  LOG_LEVEL: Joi.string().valid('trace', 'debug', 'info', 'warn', 'error', 'fatal').default('info'),
});

export default registerAs('app', (): AppConfig => ({
  port: parseInt(process.env.PORT || '3004', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    name: process.env.DB_NAME!,
  },
  jwt: {
    secret: process.env.INTERNAL_JWT_SECRET!,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || '').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'payment-service',
    paymentTopic: process.env.PAYMENT_TOPIC || 'payment-events',
    orderTopic: process.env.ORDER_TOPIC || 'order-events',
  },
  outbox: {
    pollIntervalMs: parseInt(process.env.OUTBOX_POLL_INTERVAL_MS || '2000', 10),
  },
  payment: {
    provider: process.env.PAYMENT_PROVIDER || 'mock',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  refund: {
    approvalLimit: parseInt(process.env.REFUND_APPROVAL_LIMIT || '500', 10),
    allowSingleApprover: process.env.ALLOW_SINGLE_APPROVER_REFUND === 'true',
  },
  logLevel: process.env.LOG_LEVEL || 'info',
}));
