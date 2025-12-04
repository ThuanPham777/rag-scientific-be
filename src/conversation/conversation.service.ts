import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateConversationRequestDto,
  ConversationMode,
} from './dto/create-conversation-request.dto';
import {
  CreateConversationResponseDto,
  ConversationItemDto,
} from './dto/create-conversation-response.dto';
import { ListConversationsResponseDto } from './dto/list-conversations-response.dto';

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  private mapToItem(c: any): ConversationItemDto {
    const dto = new ConversationItemDto();
    dto.id = c.id;
    dto.paperId = c.paperId;
    dto.userId = c.userId;
    dto.title = c.title ?? null;
    dto.mode = c.mode;
    dto.createdAt = c.createdAt;
    return dto;
  }

  async createConversation(
    userId: string,
    dto: CreateConversationRequestDto,
  ): Promise<CreateConversationResponseDto> {
    const paper = await this.prisma.paper.findFirst({
      where: { id: dto.paperId, owner_user_id: userId },
    });
    if (!paper) {
      throw new ForbiddenException('Paper not found or not owned by user');
    }

    const conv = await this.prisma.conversation.create({
      data: {
        user_id: userId,
        paper_id: dto.paperId,
        title: dto.title ?? paper.title ?? 'New conversation',
        mode: dto.mode ?? ConversationMode.novice,
      },
    });

    const res = new CreateConversationResponseDto();
    res.success = true;
    res.message = 'Conversation created';
    res.data = this.mapToItem(conv);
    return res;
  }

  async listConversations(
    userId: string,
    paperId?: string,
  ): Promise<ListConversationsResponseDto> {
    const convs = await this.prisma.conversation.findMany({
      where: { user_id: userId, ...(paperId ? { paperId } : {}) },
      orderBy: { created_at: 'desc' },
    });

    const res = new ListConversationsResponseDto();
    res.success = true;
    res.message = 'List of conversations';
    res.data = convs.map((c) => this.mapToItem(c));
    return res;
  }
}
