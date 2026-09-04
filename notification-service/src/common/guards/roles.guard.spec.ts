import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const mockContext = (user?: { roles?: string[] }): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => vi.fn(),
      getClass: () => vi.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should allow access when no roles are required', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(mockContext())).toBe(true);
  });

  it('should allow access when user has required role', () => {
    vi
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['staff', 'admin']);
    const ctx = mockContext({ roles: ['admin'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny access when user lacks required role', () => {
    vi
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['admin']);
    const ctx = mockContext({ roles: ['staff'] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should deny access when user has no roles', () => {
    vi
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['admin']);
    const ctx = mockContext({});
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should deny access when user is undefined', () => {
    vi
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['admin']);
    const ctx = mockContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
