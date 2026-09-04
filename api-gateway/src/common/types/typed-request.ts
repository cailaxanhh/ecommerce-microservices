import { Request } from 'express';

export interface GatewayUser {
  userId: string;
  role: string;
}

export interface TypedRequest extends Request {
  user?: GatewayUser;
  correlationId?: string;
}
