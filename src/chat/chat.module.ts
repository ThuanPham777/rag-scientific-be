import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaModule } from '../prisma/prisma.module';
import { S3Service } from '../upload/s3.service';

@Module({
  imports: [PrismaModule, HttpModule],
  controllers: [ChatController],
  providers: [ChatService, S3Service],
})
export class ChatModule {}
