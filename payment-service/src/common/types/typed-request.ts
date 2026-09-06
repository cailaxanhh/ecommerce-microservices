import { Request } from 'express';
import { AuthSubject } from '../../modules/auth/policy/policy.service.js';

export interface TypedRequest extends Request {
  user?: AuthSubject;
  policyResource?: Record<string, unknown>;
}