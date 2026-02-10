import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { GetMessagesResponseDto } from './dto/get-messages-response.dto';
import { ClearHistoryResponseDto } from './dto/clear-history-response.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ExplainRegionRequestDto } from './dto/explain-region-request.dto';
import {
  ApiResponseDto,
  CursorPaginationDto,
  EmptyResponseDto,
} from '../common/dto/api-response.dto';
import { GetMessagesRquestDto } from './dto/get-messages-request.dto';

@ApiTags('chat')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('ask')
  @ApiOperation({
    summary: 'Ask a question about a paper',
    description:
      'Ask a question about a specific paper using RAG (Retrieval-Augmented Generation).',
  })
  @ApiOkResponse({ type: AskQuestionResponseDto })
  async ask(
    @CurrentUser() user: any,
    @Body() dto: AskQuestionRequestDto,
  ): Promise<AskQuestionResponseDto> {
    const data = await this.chatService.askQuestion(user.id, dto);
    return ApiResponseDto.success(
      data,
      'Answer generated',
    ) as AskQuestionResponseDto;
  }

  @Post('ask-multi')
  @ApiOperation({
    summary: 'Ask a question across multiple papers',
    description:
      'Analyze and compare multiple papers simultaneously with a single question.',
  })
  @ApiOkResponse({ type: AskMultiPaperResponseDto })
  async askMultiPaper(
    @CurrentUser() user: any,
    @Body() dto: AskMultiPaperRequestDto,
  ): Promise<AskMultiPaperResponseDto> {
    const data = await this.chatService.askMultiPaper(user.id, dto);
    return ApiResponseDto.success(
      data,
      'Multi-paper answer generated',
    ) as AskMultiPaperResponseDto;
  }

  @Get('messages/:conversationId')
  @ApiOperation({
    summary: 'Get conversation message history',
    description: 'Retrieve the complete message history for a conversation.',
  })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  @ApiOkResponse({ type: GetMessagesResponseDto })
  async getMessages(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Query() query: GetMessagesRquestDto,
  ): Promise<GetMessagesResponseDto> {
    const { limit = 20, cursor } = query;

    const result = await this.chatService.getMessageHistory(
      user.id,
      conversationId,
      cursor,
      limit,
    );

    const pagination = new CursorPaginationDto(
      result.items,
      limit,
      result.nextCursor,
    );

    return ApiResponseDto.success(
      pagination,
      'Messages retrieved',
    ) as GetMessagesResponseDto;
  }

  @Post('explain-region')
  @ApiOperation({ summary: 'Explain a selected region in the PDF' })
  @ApiOkResponse({ type: AskQuestionResponseDto })
  async explainRegion(
    @CurrentUser() user: any,
    @Body() dto: ExplainRegionRequestDto,
  ): Promise<AskQuestionResponseDto> {
    const data = await this.chatService.explainRegion(user.id, dto);
    return ApiResponseDto.success(
      data,
      'Region explained',
    ) as AskQuestionResponseDto;
  }

  @Delete('history/:conversationId')
  @ApiOperation({ summary: 'Clear chat history for a conversation' })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  @ApiOkResponse({ type: ClearHistoryResponseDto })
  async clearChatHistory(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
  ): Promise<ClearHistoryResponseDto> {
    await this.chatService.clearChatHistory(user.id, conversationId);
    return EmptyResponseDto.success(
      'Chat history cleared successfully',
    ) as ClearHistoryResponseDto;
  }
}
