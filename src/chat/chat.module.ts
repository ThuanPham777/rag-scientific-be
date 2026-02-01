import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, HttpModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
