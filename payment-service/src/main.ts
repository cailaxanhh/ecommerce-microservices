import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';

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

  // ── Shutdown hooks ───────────────────────────────────────────
  app.enableShutdownHooks();

  // ── Start HTTP ───────────────────────────────────────────────
  const port = config.get<number>('app.port') || 3004;
  await app.listen(port);

  logger.log(`Payment Service listening on http://localhost:${port}/api`);
}
bootstrap();
