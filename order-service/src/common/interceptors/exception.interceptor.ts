import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();

      if (typeof exResponse === 'string') {
        message = exResponse;
      } else if (typeof exResponse === 'object' && exResponse !== null) {
        const responseObj = exResponse as Record<string, unknown>;
        message = (responseObj.message as string | string[]) ?? message;
        error = responseObj.error as string | undefined;
      }
    }

    const correlationId = request.headers['x-correlation-id'] as
      string | undefined;

    if (status >= 500) {
      this.logger.error(
        {
          err: exception,
          correlationId,
          path: request.url,
          method: request.method,
        },
        'Unhandled exception',
      );
    } else {
      this.logger.warn(
        {
          status,
          correlationId,
          path: request.url,
          method: request.method,
          message,
        },
        'Client error',
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      correlationId,
      error: error || HttpStatus[status],
      timestamp: new Date().toISOString(),
    });
  }
}
