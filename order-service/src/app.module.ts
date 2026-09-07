import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import appConfig, { validateConfig } from './config/app.config.js';
import { Order } from './database/entities/order.entity.js';
import { OrderItem } from './database/entities/order-item.entity.js';
import { Outbox } from './database/entities/outbox.entity.js';
import { ProcessedEvent } from './database/entities/processed-event.entity.js';
import { ValidationModule } from './modules/validation/validation.module.js';
import { OutboxModule } from './modules/outbox/outbox.module.js';
import { KafkaModule } from './modules/kafka/kafka.module.js';
import { OrderModule } from './modules/order/order.module.js';
import { InventoryConsumerModule } from './modules/kafka/inventory-consumer.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './common/auth/auth.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validate: validateConfig,
      cache: true,
      expandVariables: true,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('app.db.host'),
        port: configService.get<number>('app.db.port'),
        username: configService.get<string>('app.db.user'),
        password: configService.get<string>('app.db.password'),
        database: configService.get<string>('app.db.name'),
        entities: [Order, OrderItem, Outbox, ProcessedEvent],
        synchronize: false,
        logging: configService.get<string>('app.nodeEnv') === 'development',
        ssl:
          configService.get<string>('app.nodeEnv') === 'production'
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),

    ScheduleModule.forRoot(),

    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          transport:
            configService.get<string>('app.nodeEnv') === 'development'
              ? { target: 'pino-pretty', options: { colorize: true } }
              : undefined,
          level: configService.get<string>('app.logLevel', 'info'),
          autoLogging: false,
        },
      }),
    }),

    OrderModule,
    AuthModule,
    OutboxModule,
    KafkaModule,
    InventoryConsumerModule,
    ValidationModule,
    HealthModule,
  ],
})
export class AppModule {}
