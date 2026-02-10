// src/email/email.module.ts
// Email module with provider abstraction
// To switch provider: replace ResendProvider with another implementation

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { EMAIL_PROVIDER } from './interfaces/email-provider.interface';
import { ResendProvider } from './providers/resend.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    EmailService,
    {
      // Provider abstraction - swap ResendProvider for any IEmailProvider
      provide: EMAIL_PROVIDER,
      useClass: ResendProvider,
    },
  ],
  exports: [EmailService],
})
export class EmailModule {}
