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
import { SendMessageRequestDto } from './dto/send-message-request.dto';
import { ToggleReactionRequestDto } from './dto/toggle-reaction-request.dto';
import { ReplyMessageRequestDto } from './dto/reply-message-request.dto';
import { DeleteMessageRequestDto } from './dto/delete-message-request.dto';
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

  @Post('send-message')
  @ApiOperation({
    summary: 'Send a plain chat message (no AI response)',
    description:
      'Send a message in a collaborative session without triggering AI. The message is saved and broadcast via WebSocket.',
  })
  async sendMessage(
    @CurrentUser() user: any,
    @Body() dto: SendMessageRequestDto,
  ) {
    const data = await this.chatService.sendMessage(user.id, dto);
    return ApiResponseDto.success(data, 'Message sent');
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

  // =========================================================================
  // REACTIONS
  // =========================================================================

  @Post('reactions/toggle')
  @ApiOperation({
    summary: 'Toggle a reaction on a message',
    description:
      'Add, update, or remove a reaction. Same emoji = toggle off, different emoji = update.',
  })
  async toggleReaction(
    @CurrentUser() user: any,
    @Body() dto: ToggleReactionRequestDto,
  ) {
    const data = await this.chatService.toggleReaction(user.id, dto);
    return ApiResponseDto.success(data, 'Reaction toggled');
  }

  // =========================================================================
  // REPLY TO MESSAGE
  // =========================================================================

  @Post('reply')
  @ApiOperation({
    summary: 'Reply to a message',
    description:
      'Send a reply to an existing message. Works for both user and assistant messages.',
  })
  async replyToMessage(
    @CurrentUser() user: any,
    @Body() dto: ReplyMessageRequestDto,
  ) {
    const data = await this.chatService.replyToMessage(user.id, dto);
    return ApiResponseDto.success(data, 'Reply sent');
  }

  // =========================================================================
  // DELETE MESSAGE
  // =========================================================================

  @Post('delete-message')
  @ApiOperation({
    summary: 'Soft-delete a message',
    description:
      'Soft-delete a message. Users can delete own messages. Owners can also delete assistant messages.',
  })
  async deleteMessage(
    @CurrentUser() user: any,
    @Body() dto: DeleteMessageRequestDto,
  ) {
    const data = await this.chatService.deleteMessage(user.id, dto);
    return ApiResponseDto.success(data, 'Message deleted');
  }
}
