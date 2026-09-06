import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AuthSubject {
  sub: string; // user id
  email?: string;
  role: 'customer' | 'staff' | 'admin' | 'service';
  region?: string;
  isServiceAccount?: boolean;
}

export interface PolicyContext {
  subject: AuthSubject;
  resource?: Record<string, unknown>;
}

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
}

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);
  private readonly refundApprovalLimit: number;
  private readonly allowSingleApprover: boolean;

  constructor(private readonly config: ConfigService) {
    this.refundApprovalLimit = this.config.get('app.refund.approvalLimit')!;
    this.allowSingleApprover = this.config.get(
      'app.refund.allowSingleApprover',
    )!;
  }

  evaluate(action: string, context: PolicyContext): PolicyDecision {
    switch (action) {
      case 'payment:view':
        return this.evaluateView(context);

      case 'payment:create':
        return this.evaluateCreate(context);

      case 'payment:refund':
        return this.evaluateRefund(context);

      case 'payment:list':
        return this.evaluateList(context);

      default:
        this.logger.warn(`Unknown policy action: ${action}`);
        return { allowed: false, reason: `Unknown action: ${action}` };
    }
  }

  private evaluateView(context: PolicyContext): PolicyDecision {
    const { subject, resource } = context;

    if (subject.role === 'admin') {
      return { allowed: true };
    }

    if (subject.isServiceAccount) {
      return { allowed: true };
    }

    if (subject.role === 'customer') {
      if (resource?.customerUserId === subject.sub) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Customers can only view their own payments',
      };
    }

    if (subject.role === 'staff') {
      if (!subject.region) {
        return {
          allowed: false,
          reason: 'Support agent has no region assigned',
        };
      }
      if (resource?.region === subject.region) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `Support agent can only view payments in region "${subject.region}"`,
      };
    }

    return { allowed: false, reason: 'Insufficient privileges' };
  }

  private evaluateCreate(context: PolicyContext): PolicyDecision {
    const { subject } = context;

    if (subject.role === 'admin' || subject.isServiceAccount) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: 'Only admin or service accounts can create payments',
    };
  }

  private evaluateRefund(context: PolicyContext): PolicyDecision {
    const { subject, resource } = context;

    const refundAmount = (resource?.refundAmount as number) || 0;
    const needsApproval = refundAmount >= this.refundApprovalLimit;

    if (subject.role === 'admin') {
      return { allowed: true };
    }

    if (subject.isServiceAccount) {
      return { allowed: true };
    }

    if (subject.role === 'staff') {
      if (!needsApproval || this.allowSingleApprover) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `Refund of ${refundAmount} exceeds limit ${this.refundApprovalLimit}; requires admin approval`,
      };
    }

    if (subject.role === 'customer') {
      return {
        allowed: false,
        reason: 'Customers cannot request refunds directly',
      };
    }

    return { allowed: false, reason: 'Insufficient privileges for refund' };
  }

  private evaluateList(context: PolicyContext): PolicyDecision {
    const { subject } = context;

    if (
      ['admin', 'staff', 'customer'].includes(subject.role) ||
      subject.isServiceAccount
    ) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Unknown role' };
  }
}
