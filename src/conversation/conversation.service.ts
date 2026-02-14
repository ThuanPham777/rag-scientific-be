import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RagService } from '../rag/index';
import { ConversationType } from '../../generated/prisma/client';
import { CreateConversationRequestDto } from './dto/create-conversation-request.dto';
import { ConversationItemDto } from './dto/create-conversation-response.dto';
import {
  SuggestedQuestionsResultDto,
  FollowUpQuestionsResultDto,
} from './dto/index';
import { SessionService } from '../session/session.service';

/**
 * Conversation with extra fields for list response
 */
export interface ConversationListItem extends ConversationItemDto {
  ragFileId?: string;
  paperTitle?: string;
}

/**
 * Conversation detail with messages
 */
export interface ConversationDetail extends ConversationItemDto {
  ragFileId?: string;
  paperTitle?: string;
  paperUrl?: string;
  papers: Array<{
    id: string;
    ragFileId: string;
    title?: string;
    fileName: string;
    fileUrl: string;
    orderIndex: number;
  }>;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    imageUrl?: string;
    context?: any;
    createdAt: Date;
  }>;
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragService: RagService,
    private readonly sessionService: SessionService,
  ) {}

  private mapToItem(c: any): ConversationItemDto {
    const dto = new ConversationItemDto();
    dto.id = c.id;
    dto.paperId = c.paperId;
    dto.userId = c.userId;
    dto.title = c.title ?? null;
    dto.type = c.type ?? 'SINGLE_PAPER';
    dto.isCollaborative = c.isCollaborative ?? false;
    dto.createdAt = c.createdAt;
    dto.updatedAt = c.updatedAt;
    return dto;
  }

  /**
   * Create a new conversation
   * @returns Raw conversation item
   */
  async createConversation(
    userId: string,
    dto: CreateConversationRequestDto,
  ): Promise<ConversationItemDto> {
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

    // Always create as SINGLE_PAPER type (multi-paper conversations are created via chat.service)
    const conv = await this.prisma.conversation.create({
      data: {
        userId,
        paperId: paper.id,
        type: ConversationType.SINGLE_PAPER,
        title: dto.title ?? paper.title ?? 'New conversation',
      },
    });

    return this.mapToItem(conv);
  }

  /**
   * List conversations for a user
   * @returns Raw array of conversation items
   */
  async listConversations(
    userId: string,
    paperId?: string,
    type?: ConversationType,
  ): Promise<ConversationListItem[]> {
    // Build base ownership filter
    const ownerFilter: any = { userId };

    // Build type filter
    if (type) {
      ownerFilter.type = type;
    } else if (paperId) {
      // If paperId is specified, show single-paper and group conversations
      ownerFilter.type = {
        in: [ConversationType.SINGLE_PAPER, ConversationType.GROUP],
      };
    }

    if (paperId) {
      // Support both id and ragFileId
      const paper = await this.prisma.paper.findFirst({
        where: {
          OR: [
            { id: paperId, userId },
            { ragFileId: paperId, userId },
            // Also find papers the user has access to via session membership
            { id: paperId },
            { ragFileId: paperId },
          ],
        },
      });
      if (paper) {
        ownerFilter.paperId = paper.id;
      }
    }

    // Also find GROUP conversations where user is a session member (not owner)
    // Only include this filter for GROUP type or when no type filter is specified
    // Skip for MULTI_PAPER type since those are never collaborative
    const sessionMemberFilter: any = {
      isCollaborative: true,
      type: ConversationType.GROUP,
      sessionMembers: {
        some: { userId, isActive: true },
      },
    };
    if (paperId && ownerFilter.paperId) {
      sessionMemberFilter.paperId = ownerFilter.paperId;
    }

    // If filtering for MULTI_PAPER specifically, skip the session member filter
    const shouldIncludeSessionFilter = !type || type === ConversationType.GROUP;

    const convs = await this.prisma.conversation.findMany({
      where: shouldIncludeSessionFilter
        ? { OR: [ownerFilter, sessionMemberFilter] }
        : ownerFilter,
      orderBy: { createdAt: 'desc' },
      include: {
        paper: {
          select: { ragFileId: true, title: true },
        },
      },
    });

    // Deduplicate by ID (in case both filters match the same record)
    const seen = new Set<string>();
    const unique = convs.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    return unique.map((c) => ({
      ...this.mapToItem(c),
      ragFileId: c.paper?.ragFileId,
      paperTitle: c.paper?.title,
    }));
  }

  /**
   * Get conversation by ID with messages
   * @returns Raw conversation detail with messages
   */
  async getConversationById(
    userId: string,
    id: string,
  ): Promise<ConversationDetail> {
    const includeClause = {
      messages: {
        orderBy: { createdAt: 'asc' as const },
      },
      paper: {
        select: {
          id: true,
          ragFileId: true,
          title: true,
          fileUrl: true,
          fileName: true,
        },
      },
    };

    // Try ownership first
    let conv = await this.prisma.conversation.findFirst({
      where: { id, userId },
      include: includeClause,
    });

    // If not found as owner, check session membership
    if (!conv) {
      const { hasAccess } = await this.sessionService.checkAccess(userId, id);
      if (hasAccess) {
        conv = await this.prisma.conversation.findFirst({
          where: { id },
          include: includeClause,
        });
      }
    }

    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }

    // For single-paper, use the paper relation
    // For multi-paper, paper info is derived from assistant message citations
    const papers = conv.paper
      ? [
          {
            id: conv.paper.id,
            ragFileId: conv.paper.ragFileId,
            title: conv.paper.title,
            fileName: conv.paper.fileName,
            fileUrl: conv.paper.fileUrl,
            orderIndex: 0,
          },
        ]
      : [];

    return {
      ...this.mapToItem(conv),
      ragFileId: conv.paper?.ragFileId,
      paperTitle: conv.paper?.title,
      paperUrl: conv.paper?.fileUrl,
      papers,
      messages: conv.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        imageUrl: m.imageUrl,
        context: m.context,
        createdAt: m.createdAt,
      })),
    };
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(userId: string, id: string): Promise<void> {
    const conv = await this.prisma.conversation.findFirst({
      where: { id, userId },
    });

    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }

    await this.prisma.conversation.delete({ where: { id } });
  }

  // ============================================================
  // Suggested Questions (conversation-level)
  // ============================================================

  /**
   * Generate suggested questions for a conversation.
   * Always calls RAG, saves results to DB, returns saved questions.
   * No cache checks — every call generates fresh questions.
   */
  async generateSuggestedQuestions(
    userId: string,
    conversationId: string,
    textInput?: string,
  ): Promise<SuggestedQuestionsResultDto> {
    // Try ownership first, then session membership
    let conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: { paper: { select: { ragFileId: true, status: true } } },
    });

    if (!conv) {
      const { hasAccess } = await this.sessionService.checkAccess(
        userId,
        conversationId,
      );
      if (hasAccess) {
        conv = await this.prisma.conversation.findFirst({
          where: { id: conversationId },
          include: { paper: { select: { ragFileId: true, status: true } } },
        });
      }
    }

    if (!conv) throw new NotFoundException('Conversation not found');
    if (!conv.paper || conv.paper.status !== 'COMPLETED') {
      throw new NotFoundException('Paper has not been processed yet');
    }

    try {
      const response = await this.ragService.brainstormQuestions(
        conv.paper.ragFileId,
        textInput,
      );

      const questions = response.questions || [];

      const created = await Promise.all(
        questions.map((q) =>
          this.prisma.suggestedQuestion.create({
            data: {
              conversationId,
              question: q,
            },
          }),
        ),
      );

      return {
        conversationId,
        questions: created.map((q) => ({
          id: q.id,
          question: q.question,
        })),
      };
    } catch (error) {
      this.logger.error(
        `Generate suggested questions failed for conversation: ${conversationId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get suggested questions stored in the database (read-only, no RAG call).
   */
  async getSuggestedQuestions(
    userId: string,
    conversationId: string,
  ): Promise<SuggestedQuestionsResultDto> {
    // Try ownership first, then session membership
    let conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conv) {
      const { hasAccess } = await this.sessionService.checkAccess(
        userId,
        conversationId,
      );
      if (hasAccess) {
        conv = await this.prisma.conversation.findFirst({
          where: { id: conversationId },
        });
      }
    }

    if (!conv) throw new NotFoundException('Conversation not found');

    const rows = await this.prisma.suggestedQuestion.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      conversationId,
      questions: rows.map((q) => ({
        id: q.id,
        question: q.question,
      })),
    };
  }

  // ============================================================
  // Follow-Up Questions (message-level, ephemeral — no DB storage)
  // ============================================================

  /**
   * Generate follow-up questions for an assistant message.
   * Calls RAG on-the-fly and returns the questions without persisting them.
   */
  async getFollowUpQuestions(
    userId: string,
    conversationId: string,
    messageId: string,
  ): Promise<FollowUpQuestionsResultDto> {
    // Try ownership first, then session membership
    let conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: { paper: { select: { ragFileId: true } } },
    });

    if (!conv) {
      const { hasAccess } = await this.sessionService.checkAccess(
        userId,
        conversationId,
      );
      if (hasAccess) {
        conv = await this.prisma.conversation.findFirst({
          where: { id: conversationId },
          include: { paper: { select: { ragFileId: true } } },
        });
      }
    }

    if (!conv) throw new NotFoundException('Conversation not found');

    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId },
    });

    if (!message) throw new NotFoundException('Message not found');

    // Only generate for assistant messages
    if (message.role !== 'ASSISTANT') {
      return { messageId, questions: [] };
    }

    const ragFileId = conv.paper?.ragFileId;
    if (!ragFileId) {
      return { messageId, questions: [] };
    }

    try {
      const response = await this.ragService.generateFollowUpQuestions(
        ragFileId,
        message.content,
      );

      return {
        messageId,
        questions: response.questions || [],
      };
    } catch (error) {
      this.logger.error(
        `Follow-up questions failed for message: ${messageId}`,
        error,
      );
      throw error;
    }
  }
}
