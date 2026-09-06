import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';

/**
 * Ensures every request/response carries a correlationId.
 * Priority: incoming header → generated UUID.
 */
@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const correlationId = (req.headers['x-correlation-id'] as string) || uuid();

    // Attach to request for downstream use
    req.headers['x-correlation-id'] = correlationId;

    // Set response header
    res.setHeader('x-correlation-id', correlationId);

    return next.handle().pipe(
      tap(() => {
        // Ensure header is set even if controller forgets
        if (!res.getHeader('x-correlation-id')) {
          res.setHeader('x-correlation-id', correlationId);
        }
      }),
    );
  }
}
