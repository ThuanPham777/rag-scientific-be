// src/email/interfaces/email-provider.interface.ts
// Provider abstraction for email sending
// Allows easy swapping between Resend, SendGrid, Mailtrap, etc.

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Email provider interface - implement this to add a new email provider
 * Examples: ResendProvider, SendGridProvider, MailtrapProvider
 */
export interface IEmailProvider {
  /**
   * Send an email using the provider
   */
  send(options: SendEmailOptions): Promise<SendEmailResult>;
}

/**
 * Injection token for the email provider
 */
export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';
