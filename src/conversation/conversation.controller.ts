import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
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
  @ApiOperation({ summary: 'Tạo conversation mới cho một paper' })
  @ApiOkResponse({ type: CreateConversationResponseDto })
  create(
    @CurrentUser() user: any,
    @Body() dto: CreateConversationRequestDto,
  ): Promise<CreateConversationResponseDto> {
    return this.conversationService.createConversation(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách conversation của user' })
  @ApiOkResponse({ type: ListConversationsResponseDto })
  list(
    @CurrentUser() user: any,
    @Query('paperId') paperId?: string,
  ): Promise<ListConversationsResponseDto> {
    return this.conversationService.listConversations(user.id, paperId);
  }
}
