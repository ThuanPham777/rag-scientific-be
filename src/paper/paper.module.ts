import { Module } from '@nestjs/common';
import { PaperController } from './paper.controller';
import { PaperService } from './paper.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';
import { ChatModule } from '../chat/chat.module';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [PrismaModule, UploadModule, SessionModule, ChatModule],
  controllers: [PaperController],
  providers: [PaperService],
  exports: [PaperService],
})
export class PaperModule {}
