import {
  BadRequestException,
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
import {
  ConversationHistoryItemDto,
} from './dto/conversation-history.dto';

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
    tabOrder?: number;
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
  ) { }

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

  // ============================================================
  // Chat History
  // ============================================================

  /**
   * Get full conversation history for a user with enriched stats.
   */
  async getConversationHistory(
    userId: string,
  ): Promise<ConversationHistoryItemDto[]> {
    // Fetch all owned conversations
    const ownedConvs = await this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        paper: { select: { id: true, fileName: true, title: true } },
        conversationPapers: {
          include: {
            paper: { select: { id: true, fileName: true, title: true } },
          },
        },
        sessionMembers: {
          where: { isActive: true },
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        },
        _count: { select: { messages: { where: { role: { not: 'SYSTEM' } } } } },
      },
    });

    // Fetch collab conversations where user is member (not owner)
    const memberConvs = await this.prisma.conversation.findMany({
      where: {
        isCollaborative: true,
        userId: { not: userId },
        sessionMembers: { some: { userId, isActive: true } },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        paper: { select: { id: true, fileName: true, title: true } },
        conversationPapers: {
          include: {
            paper: { select: { id: true, fileName: true, title: true } },
          },
        },
        sessionMembers: {
          where: { isActive: true },
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        },
        _count: { select: { messages: { where: { role: { not: 'SYSTEM' } } } } },
      },
    });

    const allConvs = [...ownedConvs, ...memberConvs];
    // Deduplicate
    const seen = new Set<string>();
    const unique = allConvs.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    // For each conversation, get last message timestamp
    const convIds = unique.map((c) => c.id);
    const lastMessages = await this.prisma.message.findMany({
      where: { conversationId: { in: convIds } },
      orderBy: { createdAt: 'desc' },
      distinct: ['conversationId'],
      select: { conversationId: true, createdAt: true },
    });
    const lastMsgMap = new Map<string, Date>();
    for (const m of lastMessages) {
      lastMsgMap.set(m.conversationId, m.createdAt);
    }

    return unique.map((c) => {
      // Collect papers
      let papers: ConversationHistoryItemDto['papers'] = [];
      if (c.type === ConversationType.MULTI_PAPER && (c as any).conversationPapers?.length > 0) {
        papers = (c as any).conversationPapers.map((cp: any) => ({
          id: cp.paper.id,
          fileName: cp.paper.fileName,
          title: cp.paper.title ?? undefined,
        }));
      } else if ((c as any).paper) {
        papers = [{
          id: (c as any).paper.id,
          fileName: (c as any).paper.fileName,
          title: (c as any).paper.title ?? undefined,
        }];
      }

      // Collect members for collab sessions
      let members: ConversationHistoryItemDto['members'] = undefined;
      if (c.isCollaborative && (c as any).sessionMembers?.length > 0) {
        members = (c as any).sessionMembers.map((sm: any) => ({
          userId: sm.user.id,
          displayName: sm.user.displayName || 'Anonymous',
          avatarUrl: sm.user.avatarUrl ?? undefined,
          role: sm.role,
        }));
      }

      return {
        id: c.id,
        title: c.title ?? undefined,
        type: c.type,
        isCollaborative: c.isCollaborative,
        isClosed: (c as any).isClosed ?? false,
        startedAt: c.createdAt,
        lastInteractionAt: lastMsgMap.get(c.id) ?? c.updatedAt,
        messageCount: (c as any)._count?.messages ?? 0,
        papers,
        members,
      };
    });
  }

  /**
   * Rename a conversation (owner only).
   */
  async updateConversationTitle(
    userId: string,
    conversationId: string,
    title: string,
  ): Promise<ConversationItemDto> {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { title: title.trim().substring(0, 300) },
    });
    return this.mapToItem(updated);
  }

  /**
   * Close a conversation so no further chat is allowed.
   */
  async closeConversation(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if ((conv as any).isClosed)
      throw new BadRequestException('Conversation is already closed');

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { isClosed: true } as any,
    });
  }

  /**
   * Fire-and-forget auto-title generation.
   * Triggered after the first user message is saved.
   * Only runs when title is still the default value.
   */
  async generateAutoTitle(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    try {
      const conv = await this.prisma.conversation.findFirst({
        where: { id: conversationId, userId },
        include: {
          paper: { select: { title: true } },
          conversationPapers: {
            include: { paper: { select: { title: true } } },
            take: 1,
          },
          messages: {
            where: { role: 'USER' },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { content: true },
          },
        },
      });

      if (!conv) return;
      // Only auto-title when still default
      const defaultTitles = ['New conversation', null, ''];
      if (!defaultTitles.includes(conv.title ?? '')) return;

      const firstMsg = (conv as any).messages?.[0]?.content || '';
      if (!firstMsg) return;

      const paperTitle =
        (conv as any).paper?.title ||
        (conv as any).conversationPapers?.[0]?.paper?.title ||
        '';

      const generated = await this.ragService.generateTitle(
        paperTitle,
        firstMsg,
      );

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { title: generated },
      });
    } catch (err) {
      this.logger.warn(`Auto-title failed for ${conversationId}: ${err?.message}`);
    }
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

    // Check if paper has an active GROUP conversation
    const existingGroupConv = await this.prisma.conversation.findFirst({
      where: {
        paperId: paper.id,
        type: ConversationType.GROUP,
        isCollaborative: true,
      },
      include: {
        sessionMembers: {
          where: { isActive: true },
          select: { userId: true },
        },
      },
    });

    // If there's an active GROUP conversation and the user is NOT an active member,
    // prevent creating a new SINGLE_PAPER conversation
    if (existingGroupConv && existingGroupConv.sessionMembers.length > 0) {
      const isActiveMember = existingGroupConv.sessionMembers.some(
        (m) => m.userId === userId,
      );
      if (!isActiveMember) {
        throw new ForbiddenException(
          'This paper is being used in an active collaborative session',
        );
      }
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
        sessionMembers: {
          where: { userId },
          select: { isActive: true },
        },
      },
    });

    // Filter out collaborative conversations where owner has left (not an active member)
    const filtered = convs.filter((c) => {
      // Non-collaborative conversations: owner always has access
      if (!c.isCollaborative) return true;

      // Collaborative conversations: must be an active member
      return c.sessionMembers.length > 0 && c.sessionMembers[0].isActive;
    });

    // Deduplicate by ID (in case both filters match the same record)
    const seen = new Set<string>();
    const unique = filtered.filter((c) => {
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
      conversationPapers: {
        orderBy: { tabOrder: 'asc' as const },
        include: {
          paper: {
            select: {
              id: true,
              ragFileId: true,
              title: true,
              fileUrl: true,
              fileName: true,
            },
          },
        },
      },
      sessionMembers: {
        where: { userId },
        select: { isActive: true },
      },
    };

    // Try ownership first
    let conv = await this.prisma.conversation.findFirst({
      where: { id, userId },
      include: includeClause,
    });

    // If found as owner but it's collaborative, check if user is still active member
    if (conv && conv.isCollaborative) {
      const isActiveMember =
        conv.sessionMembers.length > 0 && conv.sessionMembers[0].isActive;
      if (!isActiveMember) {
        // Owner has left the session, deny access
        conv = null;
      }
    }

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
    // For multi-paper, use conversationPapers if available
    let papers: ConversationDetail['papers'] = [];

    if (conv.type === ConversationType.MULTI_PAPER && (conv as any).conversationPapers) {
      papers = (conv as any).conversationPapers.map((cp: any) => ({
        id: cp.paper.id,
        ragFileId: cp.paper.ragFileId,
        title: cp.paper.title,
        fileName: cp.paper.fileName,
        fileUrl: cp.paper.fileUrl,
        orderIndex: cp.tabOrder,
        tabOrder: cp.tabOrder,
      }));
    } else if (conv.paper) {
      papers = [
        {
          id: conv.paper.id,
          ragFileId: conv.paper.ragFileId,
          title: conv.paper.title,
          fileName: conv.paper.fileName,
          fileUrl: conv.paper.fileUrl,
          orderIndex: 0,
        },
      ];
    }

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
  // Session Papers Management (MULTI_PAPER)
  // ============================================================

  async addPaperToConversation(
    userId: string,
    conversationId: string,
    paperId: string,
  ): Promise<void> {
    const conv = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
        type: { in: [ConversationType.MULTI_PAPER, ConversationType.SINGLE_PAPER] },
      },
      include: { conversationPapers: { orderBy: { tabOrder: 'desc' }, take: 1 } },
    });

    if (!conv) {
      throw new NotFoundException('Conversation not found or not owned by user');
    }

    const paper = await this.prisma.paper.findFirst({
      where: { id: paperId, userId },
    });

    if (!paper) {
      throw new NotFoundException('Paper not found or not owned by user');
    }

    if (conv.type === ConversationType.SINGLE_PAPER) {
      // First, create the join record for the original paper
      await this.prisma.conversationPaper.create({
        data: {
          conversationId,
          paperId: conv.paperId,
          tabOrder: 0,
        },
      });

      // Second, create the join record for the newly added paper
      await this.prisma.conversationPaper.create({
        data: {
          conversationId,
          paperId,
          tabOrder: 1,
        },
      });

      // Finally, upgrade the conversation type to MULTI_PAPER
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          type: ConversationType.MULTI_PAPER,
          updatedAt: new Date(),
        },
      });
    } else {
      // MULTI_PAPER logic
      // Determine new tab order
      const nextOrder = conv.conversationPapers.length > 0 ? (conv.conversationPapers[0] as any).tabOrder + 1 : 0;

      await this.prisma.conversationPaper.create({
        data: {
          conversationId,
          paperId,
          tabOrder: nextOrder,
        },
      });

      // Update conversation timestamp
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    }
  }

  async removePaperFromConversation(
    userId: string,
    conversationId: string,
    paperId: string,
  ): Promise<void> {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId, type: ConversationType.MULTI_PAPER },
    });

    if (!conv) {
      throw new NotFoundException('Conversation not found or not owned by user');
    }

    try {
      await this.prisma.conversationPaper.delete({
        where: {
          conversationId_paperId: { conversationId, paperId },
        },
      });

      // Update conversation timestamp
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    } catch {
      throw new NotFoundException('Paper not found in this conversation');
    }
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
