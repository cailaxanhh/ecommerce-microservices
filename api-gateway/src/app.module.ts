import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module.js';
import { AppConfigModule } from './config/config.module.js';
import { CorrelationModule } from './common/correlation/correlation.module.js';
import { RedisThrottlerStorage } from './common/throttler/throttler.js';
import { HealthModule } from './healthe/health.module.js';
import { ProxyModule } from './proxy/proxy.module.js';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const level = config.get<string>('LOG_LEVEL', 'info');
        const isDev = config.get<string>('NODE_ENV') !== 'production';
        return {
          pinoHttp: {
            level,
            transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
            mixin() {
              return { service: 'api-gateway' };
            },
          },
        };
      },
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('RATE_LIMIT_TTL', 60) * 1000,
            limit: config.get<number>('RATE_LIMIT_LIMIT', 100),
          },
        ],
        storage: new RedisThrottlerStorage(config),
      }),
    }),

    AuthModule,
    CorrelationModule,
    ProxyModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
