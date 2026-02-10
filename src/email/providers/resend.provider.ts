// Resend email provider implementation
// Docs: https://resend.com/docs

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  IEmailProvider,
  SendEmailOptions,
  SendEmailResult,
} from '../interfaces/email-provider.interface';

@Injectable()
export class ResendProvider implements IEmailProvider {
  private readonly logger = new Logger(ResendProvider.name);
  private readonly resend: Resend;
  private readonly defaultFrom: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');

    if (!apiKey) {
      this.logger.error('RESEND_API_KEY is not configured.');
      throw new Error('RESEND_API_KEY is missing');
    }

    this.resend = new Resend(apiKey);

    this.defaultFrom =
      this.config.get<string>('EMAIL_FROM') ??
      'RAG Scientific <noreply@ragscientific.com>';
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const { to, subject, html, text, from } = options;

    try {
      const response = await this.resend.emails.send({
        from: from ?? this.defaultFrom,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        ...(text && { text }),
      });

      if (response.error) {
        this.logger.error(`Resend error: ${JSON.stringify(response.error)}`);

        return {
          success: false,
          error: response.error.message ?? 'Resend failed',
        };
      }

      this.logger.log(
        `Email sent successfully via Resend: ${response.data?.id}`,
      );

      return {
        success: true,
        messageId: response.data?.id,
      };
    } catch (error) {
      this.logger.error('Failed to send email via Resend', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
