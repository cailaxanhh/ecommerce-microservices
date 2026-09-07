import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api/v1');

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

  app.enableCors();

  app.connectMicroservice({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: config.get('app.kafka.clientId'),
        brokers: config.get('app.kafka.brokers'),
      },
      consumer: {
        groupId: `${config.get('app.kafka.clientId')}-group`,
      },
    },
  });

  app.enableShutdownHooks();

  const port = config.get('app.port') || 3003;
  await app.startAllMicroservices();

  await app.listen(port);

  logger.log(`Order Service listening on http://localhost:${port}/api`);
  logger.log('Kafka microservice also listening');
}
await bootstrap();
