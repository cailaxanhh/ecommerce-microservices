import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import Joi from 'joi';

import appConfig, { appConfigValidation } from './config/app.config.js';
import ormConfig from './config/typeorm.config.js';

import { AuthModule } from './modules/auth/auth.module.js';
import { PaymentsModule } from './modules/payment/payments.module.js';
import { KafkaModule } from './modules/kafka/kafka.module.js';
import { OutboxModule } from './modules/outbox/outbox.module.js';
import { HealthModule } from './modules/health/health.module.js';

import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor.js';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter.js';

import {
  Payment,
  LedgerEntry,
  Outbox,
  ProcessedEvent,
} from './database/entities/index.js';

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

    AuthModule,
    PaymentsModule,
    KafkaModule,
    OutboxModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationIdInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
