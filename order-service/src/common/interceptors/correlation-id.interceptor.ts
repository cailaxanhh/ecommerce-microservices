import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  private static readonly HEADER_NAME = 'x-correlation-id';
  private readonly logger = new Logger(CorrelationIdInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const correlationId =
      (request.headers[CorrelationIdInterceptor.HEADER_NAME] as string) ||
      uuidv4();

    request.headers[CorrelationIdInterceptor.HEADER_NAME] = correlationId;

    response.setHeader(CorrelationIdInterceptor.HEADER_NAME, correlationId);

    this.logger.debug({ correlationId }, 'Request correlation ID set');

    return next.handle().pipe(
      tap(() => {
        this.logger.debug({ correlationId }, 'Request completed');
      }),
    );
  }

  static getHeaderName(): string {
    return this.HEADER_NAME;
  }
}
