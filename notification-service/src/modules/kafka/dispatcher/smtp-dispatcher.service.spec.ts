import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MailerService } from '@nestjs-modules/mailer';
import { SmtpDispatcher } from './smtp-dispatcher.service.js';
import { NotificationKind } from '../../../database/entities/notification-delivery.entity.js';

describe('SmtpDispatcher', () => {
  let dispatcher: SmtpDispatcher;
  let mailerService: { sendMail: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.resetAllMocks();
    mailerService = {
      sendMail: vi.fn().mockResolvedValue({ messageId: 'msg-123' }),
    };

    dispatcher = new SmtpDispatcher(mailerService as unknown as MailerService);
  });

  it('sends an EMAIL via MailerService and returns the provider message id', async () => {
    const result = await dispatcher.dispatch({
      kind: NotificationKind.EMAIL,
      recipient: 'customer@example.com',
      subject: 'Order 123 Confirmed',
      body: 'Your order has been confirmed.',
      channel: 'email',
    });

    expect(mailerService.sendMail).toHaveBeenCalledWith({
      to: 'customer@example.com',
      subject: 'Order 123 Confirmed',
      text: 'Your order has been confirmed.',
      html: 'Your order has been confirmed.',
    });
    expect(result).toEqual({ success: true, providerToken: 'msg-123' });
  });

  it('returns a failure result when sendMail rejects', async () => {
    mailerService.sendMail.mockRejectedValue(new Error('connection refused'));

    const result = await dispatcher.dispatch({
      kind: NotificationKind.EMAIL,
      recipient: 'customer@example.com',
      body: 'Hello',
      channel: 'email',
    });

    expect(result).toEqual({
      success: false,
      errorMessage: 'connection refused',
    });
  });

  it('rejects unsupported notification kinds', async () => {
    const result = await dispatcher.dispatch({
      kind: NotificationKind.SMS,
      recipient: '1234567890',
      body: 'Hello',
    });

    expect(result.success).toBe(false);
    expect(mailerService.sendMail).not.toHaveBeenCalled();
  });

  it('rejects unsupported channels', async () => {
    const result = await dispatcher.dispatch({
      kind: NotificationKind.EMAIL,
      recipient: 'customer@example.com',
      body: 'Hello',
      channel: 'sms',
    });

    expect(result.success).toBe(false);
    expect(mailerService.sendMail).not.toHaveBeenCalled();
  });
});