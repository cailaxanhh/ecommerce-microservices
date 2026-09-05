import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import {
  NotificationDispatcherImpl,
  DispatchResult,
} from './notification-dispatcher.interface.js';
import { NotificationKind } from '../../../database/entities/notification-delivery.entity.js';

@Injectable()
export class SmtpDispatcher implements NotificationDispatcherImpl {
  private readonly logger = new Logger(SmtpDispatcher.name);

  constructor(private readonly mailerService: MailerService) {}

  async dispatch(params: {
    kind: NotificationKind;
    recipient: string;
    subject?: string | null;
    body: string;
    channel?: string;
  }): Promise<DispatchResult> {
    if (params.kind !== NotificationKind.EMAIL) {
      return {
        success: false,
        errorMessage: `Unsupported notification kind: ${params.kind}`,
      };
    }

    if (params.channel && params.channel !== 'email') {
      return {
        success: false,
        errorMessage: `Unsupported channel: ${params.channel}`,
      };
    }

    try {
      const info = await this.mailerService.sendMail({
        to: params.recipient,
        subject: params.subject ?? '',
        text: params.body,
        html: params.body,
      });

      this.logger.log(
        `Sent email to ${params.recipient} (messageId=${info.messageId})`,
      );
      return {
        success: true,
        providerToken: info.messageId,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`SMTP send failed for ${params.recipient}: ${message}`);
      return {
        success: false,
        errorMessage: message,
      };
    }
  }
}