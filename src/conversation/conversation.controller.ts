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
import { GetConversationResponseDto } from './dto/get-conversation-response.dto';
import { DeleteConversationResponseDto } from './dto/delete-conversation-response.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import {
  ApiResponseDto,
  EmptyResponseDto,
} from '../common/dto/api-response.dto';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new conversation for a paper' })
  @ApiOkResponse({ type: CreateConversationResponseDto })
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateConversationRequestDto,
  ): Promise<CreateConversationResponseDto> {
    const data = await this.conversationService.createConversation(
      user.id,
      dto,
    );
    return ApiResponseDto.success(
      data,
      'Conversation created',
    ) as CreateConversationResponseDto;
  }

  @Get()
  @ApiOperation({ summary: 'List conversations for the user' })
  @ApiOkResponse({ type: ListConversationsResponseDto })
  @ApiQuery({
    name: 'paperId',
    required: false,
    description: 'Filter by paper ID or RAG file_id',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['SINGLE_PAPER', 'MULTI_PAPER'],
    description: 'Filter by conversation type',
  })
  async list(
    @CurrentUser() user: any,
    @Query('paperId') paperId?: string,
    @Query('type') type?: 'SINGLE_PAPER' | 'MULTI_PAPER',
  ): Promise<ListConversationsResponseDto> {
    const data = await this.conversationService.listConversations(
      user.id,
      paperId,
      type as any,
    );
    return ApiResponseDto.success(
      data,
      'List of conversations',
    ) as ListConversationsResponseDto;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get conversation by ID' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiOkResponse({ type: GetConversationResponseDto })
  async getById(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<GetConversationResponseDto> {
    const data = await this.conversationService.getConversationById(
      user.id,
      id,
    );
    return ApiResponseDto.success(
      data,
      'Conversation found',
    ) as GetConversationResponseDto;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiOkResponse({ type: DeleteConversationResponseDto })
  async delete(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<DeleteConversationResponseDto> {
    await this.conversationService.deleteConversation(user.id, id);
    return EmptyResponseDto.success(
      'Conversation deleted successfully',
    ) as DeleteConversationResponseDto;
  }
}
