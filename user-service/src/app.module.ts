import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { LoggerModule } from 'nestjs-pino';
import { User } from './domain/entities/user.entity.js';
import { Address } from './domain/entities/address.entity.js';
import { PersistenceModule } from './infrastructure/persistence/persistence.module.js';
import { UserApplicationService } from './user/user.application.service.js';
import { AddressApplicationService } from './user/address.application.service.js';
import { UserController } from './interface/http/controllers/user.controller.js';
import { HealthController } from './interface/http/controllers/health.controller.js';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './common/jwt-auth.guard.js';
import { AppConfigModule } from './config/config.module.js';

@Module({
  imports: [
    AppConfigModule,
    TerminusModule,
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL', 'info'),
          transport:
            config.get<string>('NODE_ENV') !== 'production'
              ? {
                  target: 'pino-pretty',
                  options: { colorize: true, singleLine: true },
                }
              : undefined,
        },
      }),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_NAME'),
        entities: [User, Address],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      global: true,
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('INTERNAL_JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
    PersistenceModule,
  ],
  controllers: [UserController, HealthController],
  providers: [UserApplicationService, AddressApplicationService, JwtAuthGuard],
})
export class AppModule {}
