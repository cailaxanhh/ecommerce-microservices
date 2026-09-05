import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import appConfig, { validateConfig } from './config/app.config';
import { Order } from './database/entities/order.entity';
import { OrderItem } from './database/entities/order-item.entity';
import { Outbox } from './database/entities/outbox.entity';
import { ProcessedEvent } from './database/entities/processed-event.entity';

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
        synchronize: false, // Use migrations in production
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
  ],
})
export class AppModule {}
