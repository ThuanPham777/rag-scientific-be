import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationRequestDto } from './dto/create-conversation-request.dto';
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
    dto.createdAt = c.createdAt;
    dto.updatedAt = c.updatedAt;
    return dto;
  }

  async createConversation(
    userId: string,
    dto: CreateConversationRequestDto,
  ): Promise<CreateConversationResponseDto> {
    // Find paper by ragFileId or id
    const paper = await this.prisma.paper.findFirst({
      where: {
        OR: [
          { id: dto.paperId, userId },
          { ragFileId: dto.paperId, userId },
        ],
      },
    });

    if (!paper) {
      throw new ForbiddenException('Paper not found or not owned by user');
    }

    const conv = await this.prisma.conversation.create({
      data: {
        userId,
        paperId: paper.id,
        title: dto.title ?? paper.title ?? 'New conversation',
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
    const whereClause: any = { userId };

    if (paperId) {
      // Support both id and ragFileId
      const paper = await this.prisma.paper.findFirst({
        where: {
          OR: [
            { id: paperId, userId },
            { ragFileId: paperId, userId },
          ],
        },
      });
      if (paper) {
        whereClause.paperId = paper.id;
      }
    }

    const convs = await this.prisma.conversation.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        paper: {
          select: { ragFileId: true, title: true },
        },
      },
    });

    const res = new ListConversationsResponseDto();
    res.success = true;
    res.message = 'List of conversations';
    res.data = convs.map((c) => ({
      ...this.mapToItem(c),
      ragFileId: c.paper?.ragFileId,
      paperTitle: c.paper?.title,
    }));
    return res;
  }

  async getConversationById(userId: string, id: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        paper: {
          select: { ragFileId: true, title: true, fileUrl: true },
        },
      },
    });

    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }

    return {
      success: true,
      message: 'Conversation found',
      data: {
        ...this.mapToItem(conv),
        ragFileId: conv.paper?.ragFileId,
        paperTitle: conv.paper?.title,
        paperUrl: conv.paper?.fileUrl,
        messages: conv.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          imageUrl: m.imageUrl,
          context: m.context,
          createdAt: m.createdAt,
        })),
      },
    };
  }

  async deleteConversation(
    userId: string,
    id: string,
  ): Promise<{ success: boolean }> {
    const conv = await this.prisma.conversation.findFirst({
      where: { id, userId },
    });

    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }

    await this.prisma.conversation.delete({ where: { id } });

    return { success: true };
  }
}
