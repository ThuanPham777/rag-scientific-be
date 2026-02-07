import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
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
  EmptyResponseDto,
} from '../common/dto/api-response.dto';

@ApiTags('chat')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('ask')
  @ApiOperation({
    summary: 'Ask a question about a paper',
    description: `Ask a question about a specific paper using RAG (Retrieval-Augmented Generation).

**How it works:**
1. Finds relevant content from the paper using vector search
2. Uses AI to generate contextual answers based on the content
3. Returns answer with precise citations and page references

**Features:**
- Supports text, image, and table content analysis
- Maintains conversation context within the same conversation
- Provides citation metadata (page numbers, bounding boxes, etc.)

**Requirements:**
- Paper must be fully processed (status: COMPLETED)
- Valid conversation ID for the paper`,
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
    description: `Analyze and compare multiple papers simultaneously with a single question.

**Multi-Paper Analysis:**
- Searches across all specified papers
- Compares information between different sources
- Identifies contradictions or consensus
- Provides citations from multiple papers

**Use Cases:**
- Literature reviews
- Comparative analysis
- Finding consensus across research
- Identifying research gaps

**Returns:** Comprehensive answer with sources from each paper`,
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
    description: `Retrieve the complete message history for a conversation.

**Message Types:**
- **USER**: Questions asked by the user
- **ASSISTANT**: AI-generated responses with citations

**Included Data:**
- All messages in chronological order
- Citation information with page references
- Token usage statistics
- Model information used for responses

**Usage:** Display chat history in the frontend interface`,
  })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  @ApiOkResponse({ type: GetMessagesResponseDto })
  async getMessages(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
  ): Promise<GetMessagesResponseDto> {
    const data = await this.chatService.getMessageHistory(
      user.id,
      conversationId,
    );
    return ApiResponseDto.success(
      data,
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
