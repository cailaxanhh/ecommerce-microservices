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
  internalJwtSecret: string;
  userServiceUrl: string;
  productServiceUrl: string;
  kafka: {
    brokers: string[];
    clientId: string;
  };
  outboxPollIntervalMs: number;
  orderTopic: string;
  inventoryTopic: string;
  logLevel: string;
}

const validationSchema = Joi.object({
  PORT: Joi.number().default(3003),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  INTERNAL_JWT_SECRET: Joi.string().min(16).required(),
  USER_SERVICE_URL: Joi.string().uri().required(),
  PRODUCT_SERVICE_URL: Joi.string().uri().required(),
  KAFKA_BROKERS: Joi.string().required(),
  KAFKA_CLIENT_ID: Joi.string().default('order-service'),
  OUTBOX_POLL_INTERVAL_MS: Joi.number().default(2000),
  ORDER_TOPIC: Joi.string().default('order-events'),
  INVENTORY_TOPIC: Joi.string().default('inventory-events'),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),
});

export function validateConfig(record: Record<string, unknown>) {
  const { error, value } = validationSchema.validate(record, {
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: true,
  });

  if (error) {
    const missing = error.details.map((d) => d.message).join('\n');
    throw new Error(`Configuration validation error:\n${missing}`);
  }

  return value;
}

export default registerAs('app', (): AppConfig => {
  const raw: Record<string, unknown> = {
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
    INTERNAL_JWT_SECRET: process.env.INTERNAL_JWT_SECRET,
    USER_SERVICE_URL: process.env.USER_SERVICE_URL,
    PRODUCT_SERVICE_URL: process.env.PRODUCT_SERVICE_URL,
    KAFKA_BROKERS: process.env.KAFKA_BROKERS,
    KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID,
    OUTBOX_POLL_INTERVAL_MS: process.env.OUTBOX_POLL_INTERVAL_MS,
    ORDER_TOPIC: process.env.ORDER_TOPIC,
    INVENTORY_TOPIC: process.env.INVENTORY_TOPIC,
    LOG_LEVEL: process.env.LOG_LEVEL,
  };

  const validated = validateConfig(raw);

  return {
    port: validated.PORT,
    nodeEnv: validated.NODE_ENV,
    db: {
      host: validated.DB_HOST,
      port: validated.DB_PORT,
      user: validated.DB_USER,
      password: validated.DB_PASSWORD,
      name: validated.DB_NAME,
    },
    internalJwtSecret: validated.INTERNAL_JWT_SECRET,
    userServiceUrl: validated.USER_SERVICE_URL,
    productServiceUrl: validated.PRODUCT_SERVICE_URL,
    kafka: {
      brokers: validated.KAFKA_BROKERS.split(','),
      clientId: validated.KAFKA_CLIENT_ID,
    },
    outboxPollIntervalMs: validated.OUTBOX_POLL_INTERVAL_MS,
    orderTopic: validated.ORDER_TOPIC,
    inventoryTopic: validated.INVENTORY_TOPIC,
    logLevel: validated.LOG_LEVEL,
  };
});
