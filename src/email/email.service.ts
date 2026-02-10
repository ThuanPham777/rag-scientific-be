// src/email/email.service.ts
// Email service - orchestrates email sending through provider abstraction

import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  type IEmailProvider,
  EMAIL_PROVIDER,
  SendEmailResult,
} from './interfaces/email-provider.interface';
import {
  getResetPasswordEmailHtml,
  getResetPasswordEmailText,
} from './templates/reset-password.template';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: IEmailProvider,
  ) {}

  /**
   * Send password reset email
   * @param to Recipient email address
   * @param resetUrl Full URL with reset token
   * @param displayName Optional user display name for personalization
   */
  async sendPasswordResetEmail(
    to: string,
    resetUrl: string,
    displayName?: string,
  ): Promise<SendEmailResult> {
    this.logger.log(`Sending password reset email to: ${to}`);

    return this.emailProvider.send({
      to,
      subject: 'Reset Your Password - RAG Scientific',
      html: getResetPasswordEmailHtml(resetUrl, displayName),
      text: getResetPasswordEmailText(resetUrl, displayName),
    });
  }
}
