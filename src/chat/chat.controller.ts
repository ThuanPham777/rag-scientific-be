import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';
import { AskQuestionRequestDto } from './dto/ask-question-request.dto';
import { AskQuestionResponseDto } from './dto/ask-question-response.dto';
import {
  AskMultiPaperRequestDto,
  AskMultiPaperResponseDto,
} from './dto/ask-multi-paper-request.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ExplainRegionRequestDto } from './dto/explain-region-request.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('ask')
  @ApiOperation({ summary: 'Ask a question about the paper (RAG Q&A)' })
  @ApiOkResponse({ type: AskQuestionResponseDto })
  ask(
    @CurrentUser() user: any,
    @Body() dto: AskQuestionRequestDto,
  ): Promise<AskQuestionResponseDto> {
    return this.chatService.askQuestion(user.id, dto);
  }

  @Post('ask-multi')
  @ApiOperation({ summary: 'Ask a question across multiple papers' })
  @ApiOkResponse({ type: AskMultiPaperResponseDto })
  askMultiPaper(
    @CurrentUser() user: any,
    @Body() dto: AskMultiPaperRequestDto,
  ) {
    return this.chatService.askMultiPaper(user.id, dto);
  }

  @Get('messages/:conversationId')
  @ApiOperation({ summary: 'Get message history for a conversation' })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  getMessages(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
  ) {
    return this.chatService.getMessageHistory(user.id, conversationId);
  }

  @Post('explain-region')
  @ApiOperation({ summary: 'Explain a selected region in the PDF' })
  @ApiOkResponse({ type: AskQuestionResponseDto })
  explainRegion(
    @CurrentUser() user: any,
    @Body() dto: ExplainRegionRequestDto,
  ): Promise<AskQuestionResponseDto> {
    return this.chatService.explainRegion(user.id, dto);
  }
}
