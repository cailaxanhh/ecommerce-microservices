import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CORRELATION_ID_HEADER } from './correlation.constants.js';

@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const inboundId = request.headers[CORRELATION_ID_HEADER.toLowerCase()];
    const correlationId = inboundId?.length > 0 ? inboundId : null;

    request.correlationId = correlationId;
    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    if (request.log) {
      request.log = request.log.child({ correlationId });
    }

    return next.handle();
  }
}
