import { NestApplicationContext } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { LambdaContextModule } from './lambda.module.js';
import { KafkaEventProcessor } from '../modules/kafka/kafka-event.processor.service.js';

const logger = new Logger('LambdaHandler');

let cachedApp: NestApplicationContext | null = null;

async function bootstrap(): Promise<NestApplicationContext> {
  if (!cachedApp) {
    const { NestFactory } = require('@nestjs/core');
    const app = await NestFactory.createApplicationContext(LambdaContextModule, {
      bufferLogs: true,
    });
    app.enableShutdownHooks();
    cachedApp = app;
  }
  return cachedApp!;
}

interface MskRecord {
  topic: string;
  partition: number;
  offset: number;
  timestamp: number;
  key: string;
  value: string;
  headers?: Record<string, string>;
}

interface MskEvent {
  eventSource: string;
  records: Record<string, MskRecord[]>;
}

export const handler = async (event: MskEvent): Promise<void> => {
  const app = await bootstrap();
  const processor = app.get(KafkaEventProcessor);

  for (const [topic, records] of Object.entries(event.records)) {
    for (const record of records) {
      try {
        const rawValue = Buffer.from(record.value, 'base64').toString('utf8');

        const headers: Record<string, string> = {};
        if (record.headers) {
          for (const [key, val] of Object.entries(record.headers)) {
            headers[key] = Buffer.from(val, 'base64').toString('utf8');
          }
        }

        await processor.process(rawValue, {
          topic: record.topic,
          partition: String(record.partition),
          headers,
        });
      } catch (err) {
        logger.error(
          `Error processing record topic=${record.topic} partition=${record.partition} offset=${record.offset}: ${(err as Error).message}`,
        );
      }
    }
  }
};
