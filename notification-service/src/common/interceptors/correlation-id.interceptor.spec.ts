import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { CorrelationIdInterceptor } from './correlation-id.interceptor.js';

describe('CorrelationIdInterceptor', () => {
  let interceptor: CorrelationIdInterceptor;

  beforeEach(() => {
    interceptor = new CorrelationIdInterceptor();
  });

  it('should use existing x-correlation-id header when present', async () => {
    const correlationId = 'existing-correlation-id';
    const mockRequest: {
      headers: Record<string, string>;
      correlationId?: string;
    } = {
      headers: { 'x-correlation-id': correlationId },
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;

    const callHandler: CallHandler = {
      handle: () => of('response'),
    };

    const result = interceptor.intercept(context, callHandler);

    await result.toPromise();
    expect(mockRequest.correlationId).toBe(correlationId);
  });

  it('should generate a new correlationId when header is absent', async () => {
    const mockRequest: {
      headers: Record<string, string>;
      correlationId?: string;
    } = {
      headers: {},
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;

    const callHandler: CallHandler = {
      handle: () => of('response'),
    };

    const result = interceptor.intercept(context, callHandler);

    await result.toPromise();
    expect(mockRequest.correlationId).toBeDefined();
    expect(typeof mockRequest.correlationId).toBe('string');
    expect((mockRequest.correlationId as string).length).toBeGreaterThan(0);
  });
});
