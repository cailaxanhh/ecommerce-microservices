import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { POLICY_KEY, PolicyMetadata } from './policy.decorator.js';
import { PolicyService } from './policy.service.js';
import { TypedRequest } from '../../../common/types/typed-request.js';

@Injectable()
export class PolicyGuard implements CanActivate {
  private readonly logger = new Logger(PolicyGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly policyService: PolicyService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const metadata = this.reflector.get<PolicyMetadata>(
      POLICY_KEY,
      context.getHandler(),
    );

    if (!metadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest<TypedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('No authenticated user');
    }

    const resource: Record<string, unknown> =
      request.policyResource || {};

    const params = request.params;
    if (params.id) {
      resource.paymentId = params.id;
    }

    const decision = this.policyService.evaluate(metadata.action, {
      subject: user,
      resource,
    });

    if (!decision.allowed) {
      this.logger.warn(
        `Policy denied: user=${user.sub} action=${metadata.action} reason=${decision.reason}`,
      );
      throw new ForbiddenException(
        decision.reason || 'Access denied by policy',
      );
    }

    return true;
  }
}
