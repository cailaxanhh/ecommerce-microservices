import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { AppConfig } from './config/app.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // ── Global prefix ────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Validation pipe ──────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── CORS ─────────────────────────────────────────────────────
  app.enableCors();

  // ── Kafka microservice ───────────────────────────────────────
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: config.get('app.kafka.clientId')!,
        brokers: config.get('app.kafka.brokers')!,
      },
      consumer: {
        groupId: `${config.get('app.kafka.clientId')}-group`,
      },
    },
  });

  // ── Shutdown hooks ───────────────────────────────────────────
  app.enableShutdownHooks();

  // ── Start both HTTP + Kafka ──────────────────────────────────
  const port = config.get<number>('app.port') || 3004;
  await app.startAllMicroservices();
  await app.listen(port);

  logger.log(`Payment Service listening on http://localhost:${port}/api`);
  logger.log('Kafka microservice also listening');
}
bootstrap();
