import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaModule } from '../prisma/prisma.module';
import { S3Service } from '../upload/s3.service';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [PrismaModule, SessionModule],
  controllers: [ChatController],
  providers: [ChatService, S3Service],
  exports: [ChatService],
})
export class ChatModule {}
