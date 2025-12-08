import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';
import { AskQuestionRequestDto } from './dto/ask-question-request.dto';
import { AskQuestionResponseDto } from './dto/ask-question-response.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('ask')
  @ApiOperation({ summary: 'Hỏi đáp với paper (RAG Q&A)' })
  @ApiOkResponse({ type: AskQuestionResponseDto })
  ask(
    @CurrentUser() user: any,
    @Body() dto: AskQuestionRequestDto,
  ): Promise<AskQuestionResponseDto> {
    return this.chatService.askQuestion(user.id, dto);
  }
}
