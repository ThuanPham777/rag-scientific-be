import { Module } from '@nestjs/common';
import { HighlightController } from './highlight.controller';
import { HighlightService } from './highlight.service';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [SessionModule],
  controllers: [HighlightController, CommentController],
  providers: [HighlightService, CommentService],
  exports: [HighlightService, CommentService],
})
export class HighlightModule {}
