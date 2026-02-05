import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { UploadModule } from './upload/upload.module';
import { PaperModule } from './paper/paper.module';
import { ConversationModule } from './conversation/conversation.module';
import { ChatModule } from './chat/chat.module';
import { FolderModule } from './folder/folder.module';
import { GuestModule } from './guest/guest.module';
import { CleanupModule } from './cleanup/cleanup.module';
import { HighlightModule } from './highlight/highlight.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    UsersModule,
    AuthModule,
    UploadModule,
    PaperModule,
    ConversationModule,
    ChatModule,
    FolderModule,
    GuestModule,
    CleanupModule,
    HighlightModule,
  ],
})
export class AppModule {}
