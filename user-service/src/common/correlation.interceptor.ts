import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'crypto';

@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const correlationId = request.headers['x-correlation-id'] ?? randomUUID();
    request['correlationId'] = correlationId;

    const response = context.switchToHttp().getResponse();
    response.setHeader('X-Correlation-Id', correlationId);

    return next.handle().pipe(
      tap(() => {
        // logging is handled by pino; correlationId is attached to request context
      }),
    );
  }
}