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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationService } from './conversation.service';
import { CreateConversationRequestDto } from './dto/create-conversation-request.dto';
import { CreateConversationResponseDto } from './dto/create-conversation-response.dto';
import { ListConversationsResponseDto } from './dto/list-conversations-response.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new conversation for a paper' })
  @ApiOkResponse({ type: CreateConversationResponseDto })
  create(
    @CurrentUser() user: any,
    @Body() dto: CreateConversationRequestDto,
  ): Promise<CreateConversationResponseDto> {
    return this.conversationService.createConversation(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List conversations for the user' })
  @ApiOkResponse({ type: ListConversationsResponseDto })
  @ApiQuery({
    name: 'paperId',
    required: false,
    description: 'Filter by paper ID or RAG file_id',
  })
  list(
    @CurrentUser() user: any,
    @Query('paperId') paperId?: string,
  ): Promise<ListConversationsResponseDto> {
    return this.conversationService.listConversations(user.id, paperId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get conversation by ID' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  getById(@CurrentUser() user: any, @Param('id') id: string) {
    return this.conversationService.getConversationById(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.conversationService.deleteConversation(user.id, id);
  }
}
