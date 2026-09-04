import * as Joi from 'joi';

export interface GatewayConfig {
  PORT: number;
  NODE_ENV: string;
  JWT_PUBLIC_KEY: string;
  JWT_SECRET: string;
  INTERNAL_JWT_SECRET: string;
  INTERNAL_JWT_EXPIRES_IN: string;
  USER_SERVICE_URL: string;
  PRODUCT_SERVICE_URL: string;
  ORDER_SERVICE_URL: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  RATE_LIMIT_TTL: number;
  RATE_LIMIT_LIMIT: number;
  LOG_LEVEL: string;
}

export const validationSchema = Joi.object<GatewayConfig>({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  JWT_PUBLIC_KEY: Joi.string().allow('').optional(),
  JWT_SECRET: Joi.string().min(8).required(),
  INTERNAL_JWT_SECRET: Joi.string().min(8).required(),
  INTERNAL_JWT_EXPIRES_IN: Joi.string().default('300s'),
  USER_SERVICE_URL: Joi.string().uri().required(),
  PRODUCT_SERVICE_URL: Joi.string().uri().required(),
  ORDER_SERVICE_URL: Joi.string().uri().required(),
  REDIS_HOST: Joi.string().default('127.0.0.1'),
  REDIS_PORT: Joi.number().default(6379),
  RATE_LIMIT_TTL: Joi.number().default(60),
  RATE_LIMIT_LIMIT: Joi.number().default(100),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),
});
