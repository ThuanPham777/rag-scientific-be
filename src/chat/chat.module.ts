import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaModule } from '../prisma/prisma.module';
import { S3Service } from '../upload/s3.service';
import { SessionModule } from '../session/session.module';
import { UsageModule } from '../admin/usage/usage.module';

@Module({
  imports: [PrismaModule, SessionModule, UsageModule],
  controllers: [ChatController],
  providers: [ChatService, S3Service],
  exports: [ChatService],
})
export class ChatModule { }
