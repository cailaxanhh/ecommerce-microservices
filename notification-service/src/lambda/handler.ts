import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { INestApplicationContext } from '@nestjs/common';
import { LambdaConsumerModule } from './lambda.module.js';
import { KafkaEventProcessor } from '../modules/kafka/kafka-event.processor.service.js';

let cachedApp: INestApplicationContext | null = null;
let bootstrapPromise: Promise<INestApplicationContext> | null = null;

async function getProcessor(): Promise<KafkaEventProcessor> {
  if (cachedApp) {
    return cachedApp.get(KafkaEventProcessor);
  }

  if (bootstrapPromise) {
    const app = await bootstrapPromise;
    return app.get(KafkaEventProcessor);
  }

  bootstrapPromise = (async () => {
    const app = await NestFactory.createApplicationContext(LambdaConsumerModule, {
      bufferLogs: true,
    });
    app.useLogger(app.get(Logger));
    cachedApp = app;
    return app;
  })();

  try {
    const app = await bootstrapPromise;
    return app.get(KafkaEventProcessor);
  } finally {
    bootstrapPromise = null;
  }
}

interface MskRecord {
  topic: string;
  partition: number;
  offset: number;
  timestamp: number;
  key: string;
  value: string;
  headers?: Array<{ key: string; value: string }>;
}

interface MskEvent {
  eventSource: string;
  eventSourceArn: string;
  records: Record<string, MskRecord[]>;
}

export const handler = async (event: MskEvent): Promise<void> => {
  const processor = await getProcessor();

  const topicRecords = Object.values(event.records ?? {}).flat();

  for (const record of topicRecords) {
    try {
      const rawValue = Buffer.from(record.value, 'base64').toString('utf8');

      const headers: Record<string, string> = {};
      if (record.headers) {
        for (const h of record.headers) {
          const key = Buffer.from(h.key, 'base64').toString('utf8');
          const val = Buffer.from(h.value, 'base64').toString('utf8');
          headers[key] = val;
        }
      }

      await processor.process(rawValue, {
        topic: record.topic,
        partition: record.partition,
        headers,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `Error processing record from topic ${record.topic}: ${message}`,
      );
    }
  }
};
