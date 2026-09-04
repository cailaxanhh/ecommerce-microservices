import * as Joi from 'joi';

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3002),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  INTERNAL_JWT_SECRET: Joi.string().min(16).required(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_TTL: Joi.number().default(300),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),
});

export function validate(config: Record<string, unknown>) {
  const { error, value } = validationSchema.validate(config, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new Error(`Config validation error: ${error.message}`);
  }
  return value;
}
