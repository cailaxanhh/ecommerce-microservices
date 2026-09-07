import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { JwtAuthGuard } from './auth/auth.guard.js';
import { RolesGuard } from './auth/roles/roles.guard.js';
import { CorrelationInterceptor } from './common/correlation/correlation.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.use(helmet());

  app.enableCors({
    origin: config.get<string>('NODE_ENV') === 'production' ? false : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Guards
  app.useGlobalGuards(app.get(JwtAuthGuard), app.get(RolesGuard));

  // Interceptors
  app.useGlobalInterceptors(app.get(CorrelationInterceptor));

  app.enableShutdownHooks();

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);

  logger.log(`API Gateway is listening on port ${port}`, 'Bootstrap');
}
await bootstrap();
