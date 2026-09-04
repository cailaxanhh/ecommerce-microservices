import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  NotificationDispatcherImpl,
  DispatchResult,
} from './notification-dispatcher.interface.js';
import { NotificationKind } from '../../../database/entities/notification-delivery.entity.js';

@Injectable()
export class StubDispatcher implements NotificationDispatcherImpl {
  private readonly logger = new Logger(StubDispatcher.name);

  async dispatch(params: {
    kind: NotificationKind;
    recipient: string;
    subject?: string | null;
    body: string;
    channel?: string;
  }): Promise<DispatchResult> {
    this.logger.log(
      `[STUB] Dispatching ${params.kind} to ${params.recipient}` +
        ` | subject="${params.subject ?? ''}" body="${params.body.substring(0, 80)}…"`,
    );

    // Simulate async work
    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
      success: true,
      providerToken: uuid(),
    };
  }
}
