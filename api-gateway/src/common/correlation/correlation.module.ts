import { Module } from '@nestjs/common';
import { CorrelationInterceptor } from './correlation.interceptor.js';

@Module({
  providers: [CorrelationInterceptor],
  exports: [CorrelationInterceptor],
})
export class CorrelationModule {}
