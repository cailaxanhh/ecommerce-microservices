import { NotificationKind } from '../../../database/entities/notification-delivery.entity.js';

export const NotificationDispatcher = Symbol('NotificationDispatcher');

export interface DispatchResult {
  success: boolean;
  providerToken?: string;
  errorMessage?: string;
}

export interface NotificationDispatcherImpl {
  dispatch(params: {
    kind: NotificationKind;
    recipient: string;
    subject?: string | null;
    body: string;
    channel?: string;
  }): Promise<DispatchResult>;
}
