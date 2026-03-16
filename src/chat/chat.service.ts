// src/chat/chat.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../upload/s3.service';
import { RagService } from '../rag/index';
import { AskQuestionRequestDto } from './dto/ask-question-request.dto';
import {
  AskQuestionResultDto,
  ChatCitationDto,
} from './dto/ask-question-response.dto';
import { AskMultiPaperResultDto } from './dto/ask-multi-paper-request.dto';
import { MessageItemDto } from './dto/get-messages-response.dto';
import { MessageRole, ConversationType } from '../../generated/prisma/client';
import { SessionService } from '../session/session.service';
import { SessionGateway } from '../session/session.gateway';
import { UsageService } from '../admin/usage/usage.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragService: RagService,
    private readonly s3Service: S3Service,
    private readonly sessionService: SessionService,
    private readonly sessionGateway: SessionGateway,
    private readonly usageService: UsageService,
  ) { }

  /**
   * Log LLM usage from RAG response (fire-and-forget).
   */
  private logRagUsage(
    ragResponse: any,
    endpoint: string,
    userId?: string,
    conversationId?: string,
  ): void {
    try {
      const usageEntries = ragResponse?.usage;
      if (!usageEntries || !Array.isArray(usageEntries) || usageEntries.length === 0) return;

      const entries = usageEntries.map((u: any) => ({
        model: u.model || 'unknown',
        provider: u.provider || 'unknown',
        purpose: u.purpose || 'unknown',
        endpoint,
        inputTokens: u.input_tokens || 0,
        outputTokens: u.output_tokens || 0,
        userId: userId || null,
        conversationId: conversationId || null,
      }));

      this.usageService.logUsage(entries).catch(err =>
        this.logger.warn(`[Usage] Log failed: ${err.message}`),
      );
    } catch (err) {
      this.logger.warn(`[Usage] Log parse error: ${err}`);
    }
  }

  private mapCitation(
    raw: any,
    ragFileIdToPaperId?: Map<string, string>,
  ): ChatCitationDto {
    const c = new ChatCitationDto();
    c.pageNumber = raw.page_number ?? raw.pageNumber ?? raw.page ?? null;
    c.snippet = raw.snippet ?? raw.text ?? null;
    c.elementId = raw.element_id ?? raw.elementId ?? null;
    c.chunkId = raw.chunk_id ?? raw.chunkId ?? null;
    c.score = raw.score ?? null;
    c.sourceId = raw.source_id ?? raw.sourceId ?? null;
    c.sectionTitle =
      raw.section_title ?? raw.type ?? raw.metadata?.section_title ?? null;

    // Parse bbox - it might be a JSON string from Chroma
    let parsedBBox = raw.bbox ?? raw.metadata?.bbox ?? null;
    if (typeof parsedBBox === 'string') {
      try {
        parsedBBox = JSON.parse(parsedBBox);
      } catch {
        parsedBBox = null;
      }
    }
    c.bbox = parsedBBox;

    // Parse layout dimensions
    c.layoutWidth = raw.layout_width ?? raw.metadata?.layout_width ?? null;
    c.layoutHeight = raw.layout_height ?? raw.metadata?.layout_height ?? null;

    // Extract source paper ID from metadata and map to actual paper ID
    const ragSourcePaperId =
      raw.metadata?.source_paper_id ?? raw.metadata?.paper_id ?? null;
    if (ragSourcePaperId && ragFileIdToPaperId) {
      c.sourcePaperId =
        ragFileIdToPaperId.get(ragSourcePaperId) ?? ragSourcePaperId;
    } else {
      c.sourcePaperId = ragSourcePaperId;
    }

    return c;
  }

  /**
   * Send a plain chat message (no AI response).
   * Used in collaborative sessions when user doesn't @Assistant.
   */
  async sendMessage(
    userId: string,
    dto: { conversationId: string; content: string },
  ): Promise<{
    id: string;
    content: string;
    userId: string;
    displayName: string;
    avatarUrl?: string;
    createdAt: Date;
  }> {
    const { conversationId, content } = dto;

    // Verify conversation access
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (!conversation.isCollaborative) {
      throw new BadRequestException(
        'Plain messages are only supported in collaborative sessions',
      );
    }

    // Check access
    const { hasAccess } = await this.sessionService.checkAccess(
      userId,
      conversationId,
    );
    if (!hasAccess) {
      throw new ForbiddenException('You are not a member of this session');
    }

    // Create user message
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId,
        userId,
        role: MessageRole.USER,
        content,
      },
    });

    // Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Get sender info
    const senderUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, avatarUrl: true },
    });

    const displayName = senderUser?.displayName || 'User';
    const avatarUrl = senderUser?.avatarUrl || undefined;

    // Broadcast via WebSocket
    this.sessionGateway.broadcastMessage(conversationId, {
      id: userMessage.id,
      role: 'USER',
      content,
      userId,
      displayName,
      avatarUrl,
      createdAt: userMessage.createdAt,
    });

    return {
      id: userMessage.id,
      content,
      userId,
      displayName,
      avatarUrl,
      createdAt: userMessage.createdAt,
    };
  }

  /**
   * Ask a question about a paper
   * @returns Raw question result
   */
  async askQuestion(
    userId: string,
    dto: AskQuestionRequestDto,
  ): Promise<AskQuestionResultDto> {
    const { conversationId, question, imageUrl } = dto;

    // If no conversationId provided, treat as a freeform AI request (e.g. notebook "Ask AI" tool)
    if (!conversationId) {
      // directly generate a response without persisting any messages
      const gen = await this.ragService.generateText(question);
      const result = new AskQuestionResultDto();
      result.answer = gen.answer || '';
      result.citations = [];
      result.assistantMessageId = undefined;
      result.userMessageId = undefined;
      result.modelName = gen.modelName;
      result.tokenCount = gen.tokenCount;
      return result;
    }

    // 1. Verify conversation access (owner or session member)
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { paper: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check access: owner or collaborative session member
    if (conversation.isCollaborative) {
      const { hasAccess } = await this.sessionService.checkAccess(
        userId,
        conversationId,
      );
      if (!hasAccess) {
        throw new ForbiddenException('You are not a member of this session');
      }
    } else if (conversation.userId !== userId) {
      throw new ForbiddenException(
        'Conversation not found or not owned by user',
      );
    }

    // Check if conversation is closed
    if ((conversation as any).isClosed) {
      throw new BadRequestException(
        'This conversation has been closed and no longer accepts messages.',
      );
    }

    if (!conversation.paper.ragFileId) {
      throw new NotFoundException('Paper has not been processed by RAG system');
    }

    // 2. GROUP chat: require @Assistant mention to trigger AI
    //    SINGLE/MULTI chat: AI always responds (no @Assistant needed)
    if (conversation.isCollaborative) {
      const hasAssistantMention = /^@Assistant\b/i.test(question);
      if (!hasAssistantMention) {
        throw new BadRequestException(
          'In group chat, prefix your message with @Assistant to get an AI response. ' +
          'For plain messages, use the send-message endpoint.',
        );
      }
    }

    // 3. Create user message (with userId for collaborative tracking)
    // Store original content (including @Assistant prefix if present)
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId,
        userId,
        role: MessageRole.USER,
        content: question,
        imageUrl: imageUrl || null,
      },
    });

    // 3a. Fire-and-forget auto-title on first user message
    this.autoGenerateTitleIfNeeded(userId, conversationId).catch(() => { });


    //     before the (potentially slow) RAG call begins.
    if (conversation.isCollaborative) {
      const senderUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true, avatarUrl: true },
      });

      this.sessionGateway.broadcastMessage(conversationId, {
        id: userMessage.id,
        role: 'USER',
        content: question,
        userId,
        displayName: senderUser?.displayName || 'User',
        avatarUrl: senderUser?.avatarUrl || undefined,
        imageUrl: imageUrl || undefined,
        createdAt: userMessage.createdAt,
      });

      // Notify all members that the assistant is processing
      this.sessionGateway.broadcastAssistantThinking(conversationId, true);
    }

    // 4. Strip @Assistant prefix for RAG query (keep original in stored message)
    const ragQuestion = question.replace(/^@Assistant\s*/i, '').trim();

    // 4a. Load recent chat history + rolling summary for conversation memory
    const HISTORY_LIMIT = 10; // sliding window size
    const recentMessages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: HISTORY_LIMIT,
      select: { role: true, content: true, createdAt: true },
    });

    // Get most recent messages (take returns oldest first due to asc, we want latest)
    const totalMsgCount = await this.prisma.message.count({
      where: { conversationId },
    });

    // Load latest N messages (ordered chronologically)
    const latestMessages = totalMsgCount > HISTORY_LIMIT
      ? await this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: HISTORY_LIMIT,
        select: { role: true, content: true },
      }).then(msgs => msgs.reverse()) // reverse to chronological order
      : recentMessages;

    const chatHistory = latestMessages.map(m => ({
      role: m.role === 'USER' ? 'user' : 'assistant',
      content: m.content || '',
    }));

    const memorySummary = (conversation as any).memorySummary || '';

    // 4b. Load custom prompts from admin config
    const customPrompts = await this.loadCustomPrompts();

    // 5. Call RAG service with chat history + rolling summary + custom prompts
    let ragResponse;
    try {
      ragResponse = await this.ragService.query(
        conversation.paper.ragFileId,
        ragQuestion,
        {
          chat_history: chatHistory,
          summary: memorySummary,
          custom_prompts: customPrompts,
        },
      );
    } catch (error) {
      // Create error message
      const errorMessage = await this.prisma.message.create({
        data: {
          conversationId,
          role: MessageRole.ASSISTANT,
          content: 'Sorry, I encountered an error processing your question.',
        },
      });
      // Broadcast error to collaborative session
      if (conversation.isCollaborative) {
        this.sessionGateway.broadcastAssistantThinking(conversationId, false);
        this.sessionGateway.broadcastMessage(conversationId, {
          id: errorMessage.id,
          role: 'ASSISTANT',
          content: errorMessage.content,
          createdAt: errorMessage.createdAt,
        });
      }
      throw error;
    }

    const answerText = ragResponse.answer || '';
    // Log LLM usage (fire-and-forget)
    this.logRagUsage(ragResponse, 'query', userId, conversationId);
    const rawCitations = this.ragService.extractCitationsFromContext(
      ragResponse.context,
    );
    const modelName = ragResponse.context?.model_name || 'rag-model';
    const tokenCount = ragResponse.context?.token_count || 0;

    // 6. Create assistant message with context stored as JSON
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.ASSISTANT,
        content: answerText,
        modelName,
        tokenCount,
        context: this.ragService.cleanContextForStorage(
          ragResponse.context,
        ) as any,
      },
    });

    // 7. Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // 7a. Rolling summary — update memorySummary if messages exceed window
    // Run in background (fire-and-forget) to avoid blocking the response
    this.updateMemorySummaryIfNeeded(
      conversationId,
      totalMsgCount + 2,  // +2 for the user msg + assistant msg we just created
      HISTORY_LIMIT,
      memorySummary,
    ).catch(err => this.logger.warn(`[Memory] Summary update failed: ${err.message}`));

    // 7b. Broadcast assistant response to collaborative session
    if (conversation.isCollaborative) {
      this.sessionGateway.broadcastAssistantThinking(conversationId, false);
      this.sessionGateway.broadcastMessage(conversationId, {
        id: assistantMessage.id,
        role: 'ASSISTANT',
        content: answerText,
        context: ragResponse.context,
        createdAt: assistantMessage.createdAt,
      });
    }

    // 8. Build and return raw result
    const result = new AskQuestionResultDto();
    result.answer = answerText;
    result.citations = rawCitations.map((c: any) => this.mapCitation(c));
    result.assistantMessageId = assistantMessage.id;
    result.userMessageId = userMessage.id;
    result.modelName = modelName;
    result.tokenCount = tokenCount;

    return result;
  }

  /**
   * Get message history for a conversation
   * @returns Raw array of messages
   */
  async getMessageHistory(
    userId: string,
    conversationId: string,
    cursor?: string,
    limit: number = 20,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check access: owner or collaborative session member
    if (conversation.isCollaborative) {
      const { hasAccess } = await this.sessionService.checkAccess(
        userId,
        conversationId,
      );
      if (!hasAccess) {
        throw new ForbiddenException('You are not a member of this session');
      }
    } else if (conversation.userId !== userId) {
      throw new ForbiddenException(
        'Conversation not found or not owned by user',
      );
    }

    // 🔥 Prisma cursor pagination
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        role: true,
        content: true,
        imageUrl: true,
        modelName: true,
        tokenCount: true,
        context: true,
        createdAt: true,
        userId: true,
        deletedAt: true,
        replyToMessageId: true,
        user: conversation.isCollaborative
          ? { select: { displayName: true, avatarUrl: true } }
          : false,
        replyToMessage: {
          select: {
            id: true,
            content: true,
            role: true,
            deletedAt: true,
            user: { select: { displayName: true } },
          },
        },
        reactions: {
          select: {
            emoji: true,
            userId: true,
            createdAt: true,
            user: { select: { displayName: true } },
          },
        },
      },
    });

    let nextCursor: string | undefined;

    if (messages.length > limit) {
      messages.pop();
      nextCursor = messages[messages.length - 1]?.id;
    }

    // For multi-paper conversations, build citation mapping from assistant message contexts
    // Each ASSISTANT message context has citations with metadata.source_paper_id (ragFileId)
    const allRagFileIds = new Set<string>();
    for (const msg of messages) {
      if (msg.role === 'ASSISTANT' && msg.context) {
        const ctx = msg.context as any;
        const rawCitations = this.ragService.extractCitationsFromContext(ctx);
        for (const c of rawCitations) {
          const ragId = c.metadata?.source_paper_id ?? c.metadata?.paper_id;
          if (ragId) allRagFileIds.add(ragId);
        }
      }
    }

    // Fetch paper info for all referenced papers (for citation mapping)
    const ragFileIdToPaperId = new Map<string, string>();
    const paperInfoMap = new Map<
      string,
      { fileName: string; fileUrl: string | null }
    >();

    if (allRagFileIds.size > 0) {
      const referencedPapers = await this.prisma.paper.findMany({
        where: { ragFileId: { in: [...allRagFileIds] } },
        select: { id: true, ragFileId: true, fileName: true, fileUrl: true },
      });
      for (const p of referencedPapers) {
        if (p.ragFileId) {
          ragFileIdToPaperId.set(p.ragFileId, p.id);
          paperInfoMap.set(p.id, {
            fileName: p.fileName,
            fileUrl: p.fileUrl,
          });
        }
      }
    }

    // Also include single-paper conversation's paper if present
    if (conversation.paperId && !paperInfoMap.has(conversation.paperId)) {
      const singlePaper = await this.prisma.paper.findUnique({
        where: { id: conversation.paperId },
        select: { id: true, ragFileId: true, fileName: true, fileUrl: true },
      });
      if (singlePaper?.ragFileId) {
        ragFileIdToPaperId.set(singlePaper.ragFileId, singlePaper.id);
        paperInfoMap.set(singlePaper.id, {
          fileName: singlePaper.fileName,
          fileUrl: singlePaper.fileUrl,
        });
      }
    }

    const mappedMessages: MessageItemDto[] = messages.map((msg) => {
      const userRel = (msg as any).user;

      const base: MessageItemDto = {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        imageUrl: msg.imageUrl,
        modelName: msg.modelName,
        tokenCount: msg.tokenCount,
        createdAt: msg.createdAt,
        userId: msg.userId ?? undefined,
        displayName: userRel?.displayName ?? undefined,
        avatarUrl: userRel?.avatarUrl ?? undefined,
      };

      // Map reactions
      if ((msg as any).reactions?.length > 0) {
        const emojiMap = new Map<
          string,
          {
            count: number;
            hasReacted: boolean;
            reactedBy: Array<{ userId: string; displayName: string }>;
            firstReactedAt: Date;
          }
        >();
        for (const r of (msg as any).reactions) {
          const existing = emojiMap.get(r.emoji) || {
            count: 0,
            hasReacted: false,
            reactedBy: [],
            firstReactedAt: r.createdAt,
          };
          existing.count++;
          existing.reactedBy.push({
            userId: r.userId,
            displayName: r.user?.displayName || 'Unknown',
          });
          if (r.userId === userId) existing.hasReacted = true;
          // Track earliest createdAt for chronological ordering
          if (r.createdAt < existing.firstReactedAt) {
            existing.firstReactedAt = r.createdAt;
          }
          emojiMap.set(r.emoji, existing);
        }
        base.reactions = Array.from(emojiMap.entries()).map(
          ([emoji, data]) => ({
            emoji,
            count: data.count,
            hasReacted: data.hasReacted,
            reactedBy: data.reactedBy,
            firstReactedAt: data.firstReactedAt,
          }),
        );
      }

      // Map reply-to (replyToMessage is null if original was hard-deleted via onDelete: SetNull)
      if ((msg as any).replyToMessage) {
        const reply = (msg as any).replyToMessage;
        base.replyTo = {
          id: reply.id,
          content: reply.content.substring(0, 200),
          role: reply.role,
          displayName:
            reply.role === 'ASSISTANT'
              ? 'Assistant'
              : reply.user?.displayName || undefined,
        };
      }

      if (msg.role === 'ASSISTANT' && msg.context) {
        const context = msg.context as any;
        const rawCitations =
          this.ragService.extractCitationsFromContext(context);

        base.citations = rawCitations.map((c: any) => {
          const citation = this.mapCitation(c, ragFileIdToPaperId);

          if (
            citation.sourcePaperId &&
            paperInfoMap.has(citation.sourcePaperId)
          ) {
            const paperInfo = paperInfoMap.get(citation.sourcePaperId)!;
            citation.sourcePaperTitle = paperInfo.fileName;
            citation.sourceFileUrl = paperInfo.fileUrl;
          }

          return citation;
        });
      }

      return base;
    });

    return {
      items: mappedMessages,
      nextCursor,
    };
  }

  /**
   * Explain a selected region in the PDF
   * @returns Raw question result
   */
  async explainRegion(
    userId: string,
    dto: {
      conversationId?: string;
      paperId?: string;
      imageBase64: string;
      pageNumber?: number;
      question?: string;
    },
  ): Promise<AskQuestionResultDto> {
    let conversation: any;
    let conversationId = dto.conversationId;

    // If conversationId provided, verify access (owner or session member)
    if (conversationId) {
      conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { paper: true },
      });

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      // Check access: owner or collaborative session member
      if (conversation.isCollaborative) {
        const { hasAccess } = await this.sessionService.checkAccess(
          userId,
          conversationId,
        );
        if (!hasAccess) {
          throw new ForbiddenException('You are not a member of this session');
        }
      } else if (conversation.userId !== userId) {
        throw new ForbiddenException(
          'Conversation not found or not owned by user',
        );
      }
    } else if (dto.paperId) {
      // Create new conversation for the paper
      const paper = await this.prisma.paper.findFirst({
        where: { id: dto.paperId, userId },
      });

      if (!paper) {
        throw new ForbiddenException('Paper not found or not owned by user');
      }

      if (!paper.ragFileId) {
        throw new NotFoundException(
          'Paper has not been processed by RAG system',
        );
      }

      const newConv = await this.prisma.conversation.create({
        data: {
          userId,
          paperId: dto.paperId,
          title: 'Region Explanation',
        },
        include: { paper: true },
      });
      conversationId = newConv.id;
      conversation = newConv;
    } else {
      throw new BadRequestException(
        'Either conversationId or paperId is required',
      );
    }

    if (!conversation.paper.ragFileId) {
      throw new NotFoundException('Paper has not been processed by RAG system');
    }

    // Upload image to S3 for persistence
    let imageUrl: string | null = null;
    try {
      imageUrl = await this.s3Service.uploadBase64Image(
        dto.imageBase64,
        'chat-images',
        'image/png',
      );
    } catch (uploadError) {
      console.error('Failed to upload image to S3:', uploadError);
      // Continue without image URL if upload fails
    }

    // Create user message
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId,
        userId,
        role: MessageRole.USER,
        content: dto.question || 'Please explain this region.',
        imageUrl: imageUrl,
      },
    });

    // Broadcast user message IMMEDIATELY so all session members see it
    if (conversation.isCollaborative) {
      const senderUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true, avatarUrl: true },
      });

      this.sessionGateway.broadcastMessage(conversationId, {
        id: userMessage.id,
        role: 'USER',
        content: dto.question || 'Please explain this region.',
        userId,
        displayName: senderUser?.displayName || 'User',
        avatarUrl: senderUser?.avatarUrl || undefined,
        imageUrl: imageUrl || undefined,
        createdAt: userMessage.createdAt,
      });

      this.sessionGateway.broadcastAssistantThinking(conversationId, true);
    }

    // Call RAG explain-region endpoint via centralized RagService
    let ragResponse;
    try {
      ragResponse = await this.ragService.explainRegion(
        conversation.paper.ragFileId,
        dto.question || 'Please analyze and explain this cropped region.',
        dto.imageBase64,
        dto.pageNumber,
      );
    } catch (error) {
      const errorMessage = await this.prisma.message.create({
        data: {
          conversationId,
          role: MessageRole.ASSISTANT,
          content: 'Sorry, I encountered an error analyzing this region.',
        },
      });
      if (conversation.isCollaborative) {
        this.sessionGateway.broadcastAssistantThinking(conversationId, false);
        this.sessionGateway.broadcastMessage(conversationId, {
          id: errorMessage.id,
          role: 'ASSISTANT',
          content: errorMessage.content,
          createdAt: errorMessage.createdAt,
        });
      }
      throw error;
    }

    // Create assistant message
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.ASSISTANT,
        content: ragResponse.answer || '',
        context: this.ragService.cleanContextForStorage(
          ragResponse.context,
        ) as any,
      },
    });

    // Broadcast assistant response to collaborative session
    if (conversation.isCollaborative) {
      this.sessionGateway.broadcastAssistantThinking(conversationId, false);
      this.sessionGateway.broadcastMessage(conversationId, {
        id: assistantMessage.id,
        role: 'ASSISTANT',
        content: ragResponse.answer || '',
        context: ragResponse.context,
        createdAt: assistantMessage.createdAt,
      });
    }

    const result = new AskQuestionResultDto();
    result.answer = ragResponse.answer || '';
    result.citations = this.ragService
      .extractCitationsFromContext(ragResponse.context)
      .map((c: any) => this.mapCitation(c));
    result.assistantMessageId = assistantMessage.id;
    result.userMessageId = userMessage.id;
    result.conversationId = conversationId;

    return result;
  }

  /**
   * Ask a question across multiple papers
   * @returns Raw multi-paper result
   */
  async askMultiPaper(
    userId: string,
    dto: {
      paperIds?: string[];
      question: string;
      conversationId?: string;
    },
  ): Promise<AskMultiPaperResultDto> {
    const { paperIds, question, conversationId } = dto;

    let actualConversationId = conversationId;
    let activePaperIds = paperIds || [];
    let existingConv: any = null;

    if (actualConversationId) {
      // Find the conversation (don't filter by userId — collab members need access)
      existingConv = await this.prisma.conversation.findFirst({
        where: {
          id: actualConversationId,
          type: ConversationType.MULTI_PAPER,
        },
        include: {
          conversationPapers: true,
          sessionMembers: { where: { userId, isActive: true } },
        },
      });

      if (!existingConv) {
        throw new ForbiddenException(
          'Conversation not found',
        );
      }

      // Verify access: user is owner OR active session member
      const isOwner = existingConv.userId === userId;
      const isMember = existingConv.sessionMembers?.length > 0;
      if (!isOwner && !isMember) {
        throw new ForbiddenException(
          'You do not have access to this conversation',
        );
      }

      if (existingConv.conversationPapers.length > 0) {
        activePaperIds = existingConv.conversationPapers.map((cp: any) => cp.paperId);
      }
    } else {
      if (!paperIds || paperIds.length === 0) {
        throw new BadRequestException('paperIds is required to start a new multi-paper conversation');
      }

      // Try to find an existing empty or inactive multi-paper conversation... wait, no. 
      // User requested tabs persist, we shouldn't reuse an arbitrary conversation.
      // We create a new one.
      const conv = await this.prisma.conversation.create({
        data: {
          user: { connect: { id: userId } },
          type: ConversationType.MULTI_PAPER,
          title: 'Multi-paper chat',
          conversationPapers: {
            create: paperIds.map((pid, idx) => ({
              paperId: pid,
              tabOrder: idx,
            }))
          }
        },
      });
      actualConversationId = conv.id;
    }

    if (activePaperIds.length === 0) {
      throw new BadRequestException('No papers found in this conversation');
    }

    // 1. Verify all active papers exist and have ragFileId
    // For collab sessions, papers belong to the session owner — don't filter by userId
    const papers = await this.prisma.paper.findMany({
      where: {
        id: { in: activePaperIds },
      },
    });

    if (papers.length !== activePaperIds.length) {
      throw new ForbiddenException(
        'Some papers not found',
      );
    }

    const fileIds: string[] = [];
    const paperTitles: Record<string, string> = {};
    const ragFileIdToPaperId = new Map<string, string>();
    const paperInfoMap = new Map<
      string,
      { fileName: string; fileUrl: string | null; ragFileId: string }
    >();

    for (const paper of papers) {
      if (!paper.ragFileId) {
        throw new BadRequestException(
          `Paper "${paper.fileName}" has not been processed by RAG system`,
        );
      }
      fileIds.push(paper.ragFileId);
      paperTitles[paper.ragFileId] = paper.fileName;
      ragFileIdToPaperId.set(paper.ragFileId, paper.id);
      paperInfoMap.set(paper.id, {
        fileName: paper.fileName,
        fileUrl: paper.fileUrl,
        ragFileId: paper.ragFileId,
      });
    }

    // 2b. Build paper summaries for cross-paper analysis
    const paperSummaries: Record<string, string> = {};
    for (const paper of papers) {
      const parts: string[] = [];
      if ((paper as any).summary) parts.push((paper as any).summary);
      if ((paper as any).abstract) parts.push(`Abstract: ${(paper as any).abstract}`);
      if (parts.length > 0 && paper.ragFileId) {
        paperSummaries[paper.ragFileId] = parts.join('\n\n');
      }
    }

    // 3. Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: actualConversationId },
      data: {
        updatedAt: new Date(),
      },
    });

    // 4. Create user message (with userId for collaborative tracking)
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId: actualConversationId,
        userId,
        role: MessageRole.USER,
        content: question,
      },
    });

    // 4b. Broadcast user message + thinking indicator for collab sessions
    if (existingConv?.isCollaborative) {
      const senderUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true, avatarUrl: true },
      });

      this.sessionGateway.broadcastMessage(actualConversationId, {
        id: userMessage.id,
        role: 'USER',
        content: question,
        userId,
        displayName: senderUser?.displayName || 'User',
        avatarUrl: senderUser?.avatarUrl || undefined,
        createdAt: userMessage.createdAt,
      });

      this.sessionGateway.broadcastAssistantThinking(actualConversationId, true);
    }

    // 5. Call RAG service with multi-query endpoint + paper summaries
    let ragResponse;
    try {
      ragResponse = await this.ragService.queryMulti(
        fileIds,
        question,
        Object.keys(paperSummaries).length > 0 ? paperSummaries : undefined,
      );
    } catch (error) {
      await this.prisma.message.create({
        data: {
          conversationId: actualConversationId,
          role: MessageRole.ASSISTANT,
          content: 'Sorry, I encountered an error processing your question.',
        },
      });
      throw error;
    }

    const answerText = ragResponse.answer || '';
    const rawCitations = this.ragService.extractCitationsFromContext(
      ragResponse.context,
    );

    // 6. Create assistant message
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId: actualConversationId,
        role: MessageRole.ASSISTANT,
        content: answerText,
        context: this.ragService.cleanContextForStorage(
          ragResponse.context,
        ) as any,
      },
    });

    // 7. Map citations with source paper info
    const mappedCitations = rawCitations.map((c: any) => {
      const citation = this.mapCitation(c, ragFileIdToPaperId);
      // Enrich citation with paper file URL for frontend navigation
      if (citation.sourcePaperId && paperInfoMap.has(citation.sourcePaperId)) {
        const paperInfo = paperInfoMap.get(citation.sourcePaperId)!;
        citation.sourcePaperTitle = paperInfo.fileName;
        citation.sourceFileUrl = paperInfo.fileUrl;
      }
      return citation;
    });

    // 8. Map sources to paper info
    const sources = (ragResponse.sources || []).map((s: any) => {
      const paperId = ragFileIdToPaperId.get(s.paper_id) || s.paper_id;
      const paperInfo = paperInfoMap.get(paperId);
      return {
        paperId,
        title: s.title || paperTitles[s.paper_id] || 'Unknown Paper',
        fileUrl: paperInfo?.fileUrl || null,
      };
    });

    // 9. Build result (papers info comes from this request's paperIds, not DB)
    const result = new AskMultiPaperResultDto();
    result.answer = answerText;
    result.citations = mappedCitations;
    result.sources = sources;
    result.assistantMessageId = assistantMessage.id;
    result.userMessageId = userMessage.id;
    result.conversationId = actualConversationId;

    // 10. Broadcast assistant response for collab sessions
    if (existingConv?.isCollaborative) {
      this.sessionGateway.broadcastAssistantThinking(actualConversationId, false);
      this.sessionGateway.broadcastMessage(actualConversationId, {
        id: assistantMessage.id,
        role: 'ASSISTANT',
        content: answerText,
        context: this.ragService.cleanContextForStorage(
          ragResponse.context,
        ) as any,
        createdAt: assistantMessage.createdAt,
      });
    }

    return result;
  }

  /**
   * Clear chat history for a conversation
   */
  async searchLibrary(
    userId: string,
    query: string,
  ): Promise<AskMultiPaperResultDto> {
    // perform semantic search across all user papers that have been processed
    const papers = await this.prisma.paper.findMany({
      where: { userId, status: 'COMPLETED' },
      select: { ragFileId: true },
    });
    const fileIds = papers.map((p) => p.ragFileId).filter(Boolean) as string[];
    const result = new AskMultiPaperResultDto();
    if (fileIds.length === 0) {
      result.answer = '';
      result.citations = [];
      result.sources = [];
      result.conversationId = '';
      result.assistantMessageId = '';
      result.userMessageId = '';
      return result;
    }
    // call ragService.queryMulti directly without persisting messages
    // use a prompt that asks for passages containing the exact phrase
    const prompt =
      query && query.trim()
        ? `Return any extracted text passages from the documents that contain the exact phrase "${query.replace(/"/g, '\\"')}". Include at most 5 short snippets.`
        : 'Return any extracted text passages from the documents.';
    this.logger.log(
      `searchLibrary: querying RAG on ${fileIds.length} files with prompt ${prompt}`,
    );
    const ragResp = await this.ragService.queryMulti(fileIds, prompt);
    this.logger.debug('searchLibrary ragResp', JSON.stringify(ragResp));

    this.logger.log(
      `searchLibrary: querying RAG on ${fileIds.length} files with prompt ${prompt}`,
    );

    // convert raw citations to our dto format (similar to askMultiPaper mapping)
    let citations = this.ragService
      .extractCitationsFromContext(ragResp.context)
      .map((c: any) => this.mapCitation(c));

    // fallback: look through context texts directly for substring matches
    if (citations.length === 0 && ragResp.context?.texts) {
      const q = query.toLowerCase();
      const matches = (ragResp.context.texts as any[]).filter((t) =>
        (t.text || '').toLowerCase().includes(q),
      );
      if (matches.length) {
        this.logger.log(
          `searchLibrary: found ${matches.length} inline text matches`,
        );
        this.logger.log(
          `searchLibrary: found ${matches.length} inline text matches`,
        );
        citations = matches.map((t: any, i: number) => {
          const c = this.mapCitation(t);
          c.snippet = t.text;
          return c;
        });
      }
    }

    result.answer = ragResp.answer || '';
    result.citations = citations;
    // sources not provided by this endpoint so leave empty
    result.sources = [];
    result.conversationId = '';
    result.assistantMessageId = '';
    result.userMessageId = '';
    return result;
  }

  async clearChatHistory(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new ForbiddenException(
        'Conversation not found or not owned by user',
      );
    }

    await this.prisma.message.deleteMany({
      where: { conversationId },
    });
  }

  // =========================================================================
  // MESSAGE REACTIONS
  // =========================================================================

  /**
   * Toggle a reaction on a message.
   * - If user has no reaction → add it
   * - If user has same emoji → remove it (toggle off)
   * - If user has different emoji → update to new emoji
   */
  async toggleReaction(
    userId: string,
    dto: { messageId: string; emoji: string },
  ): Promise<{
    action: 'added' | 'removed' | 'updated';
    messageId: string;
    emoji: string;
    userId: string;
    conversationId: string;
  }> {
    const { messageId, emoji } = dto;

    // Verify message exists and get conversation
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Verify access to conversation
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: message.conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.isCollaborative) {
      const { hasAccess } = await this.sessionService.checkAccess(
        userId,
        message.conversationId,
      );
      if (!hasAccess) {
        throw new ForbiddenException('You are not a member of this session');
      }
    } else if (conversation.userId !== userId) {
      throw new ForbiddenException('Not authorized');
    }

    // Check existing reaction
    const existing = await this.prisma.messageReaction.findUnique({
      where: {
        messageId_userId: { messageId, userId },
      },
    });

    let action: 'added' | 'removed' | 'updated';

    if (!existing) {
      // No existing reaction → add
      await this.prisma.messageReaction.create({
        data: { messageId, userId, emoji },
      });
      action = 'added';
    } else if (existing.emoji === emoji) {
      // Same emoji → remove (toggle off)
      await this.prisma.messageReaction.delete({
        where: { id: existing.id },
      });
      action = 'removed';
    } else {
      // Different emoji → update
      await this.prisma.messageReaction.update({
        where: { id: existing.id },
        data: { emoji },
      });
      action = 'updated';
    }

    // Get aggregated reactions for broadcast
    const reactions = await this.getReactionAggregates(messageId, userId);

    // Broadcast via WebSocket
    this.sessionGateway.broadcastReactionUpdate(message.conversationId, {
      messageId,
      reactions,
      action,
      userId,
      emoji,
    });

    return {
      action,
      messageId,
      emoji,
      userId,
      conversationId: message.conversationId,
    };
  }

  /**
   * Get aggregated reactions for a message
   */
  async getReactionAggregates(
    messageId: string,
    currentUserId: string,
  ): Promise<
    Array<{
      emoji: string;
      count: number;
      hasReacted: boolean;
      reactedBy: Array<{ userId: string; displayName: string }>;
      firstReactedAt: Date;
    }>
  > {
    const reactions = await this.prisma.messageReaction.findMany({
      where: { messageId },
      select: {
        emoji: true,
        userId: true,
        createdAt: true,
        user: { select: { displayName: true } },
      },
    });

    // Group by emoji
    const emojiMap = new Map<
      string,
      {
        count: number;
        hasReacted: boolean;
        reactedBy: Array<{ userId: string; displayName: string }>;
        firstReactedAt: Date;
      }
    >();

    for (const r of reactions) {
      const existing = emojiMap.get(r.emoji) || {
        count: 0,
        hasReacted: false,
        reactedBy: [],
        firstReactedAt: r.createdAt,
      };
      existing.count++;
      existing.reactedBy.push({
        userId: r.userId,
        displayName: r.user?.displayName || 'Unknown',
      });
      if (r.userId === currentUserId) existing.hasReacted = true;
      // Track earliest createdAt for chronological ordering
      if (r.createdAt < existing.firstReactedAt) {
        existing.firstReactedAt = r.createdAt;
      }
      emojiMap.set(r.emoji, existing);
    }

    return Array.from(emojiMap.entries()).map(([emoji, data]) => ({
      emoji,
      count: data.count,
      hasReacted: data.hasReacted,
      reactedBy: data.reactedBy,
      firstReactedAt: data.firstReactedAt,
    }));
  }

  // =========================================================================
  // REPLY TO MESSAGE
  // =========================================================================

  /**
   * Send a reply to an existing message in a collaborative session.
   */
  async replyToMessage(
    userId: string,
    dto: { conversationId: string; replyToMessageId: string; content: string },
  ): Promise<{
    id: string;
    content: string;
    userId: string;
    displayName: string;
    avatarUrl?: string;
    replyToMessageId: string;
    replyTo: {
      id: string;
      content: string;
      role: string;
      displayName?: string;
      isDeleted?: boolean;
    };
    createdAt: Date;
  }> {
    const { conversationId, replyToMessageId, content } = dto;

    // Verify conversation
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check access
    if (conversation.isCollaborative) {
      const { hasAccess } = await this.sessionService.checkAccess(
        userId,
        conversationId,
      );
      if (!hasAccess) {
        throw new ForbiddenException('You are not a member of this session');
      }
    } else if (conversation.userId !== userId) {
      throw new ForbiddenException('Not authorized');
    }

    // Verify the message we're replying to exists
    const replyTarget = await this.prisma.message.findUnique({
      where: { id: replyToMessageId, conversationId },
      select: {
        id: true,
        content: true,
        role: true,
        deletedAt: true,
        user: { select: { displayName: true } },
      },
    });

    if (!replyTarget) {
      throw new NotFoundException('Original message not found');
    }

    // Create reply message
    const replyMessage = await this.prisma.message.create({
      data: {
        conversationId,
        userId,
        role: 'USER',
        content,
        replyToMessageId,
      },
    });

    // Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Get sender info
    const senderUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, avatarUrl: true },
    });

    const displayName = senderUser?.displayName || 'User';
    const avatarUrl = senderUser?.avatarUrl || undefined;

    const replyTo = {
      id: replyTarget.id,
      content: replyTarget.content.substring(0, 200),
      role: replyTarget.role,
      displayName:
        replyTarget.role === 'ASSISTANT'
          ? 'Assistant'
          : replyTarget.user?.displayName || undefined,
    };

    // Broadcast via WebSocket
    this.sessionGateway.broadcastMessage(conversationId, {
      id: replyMessage.id,
      role: 'USER',
      content,
      userId,
      displayName,
      avatarUrl,
      replyToMessageId,
      replyTo,
      createdAt: replyMessage.createdAt,
    });

    return {
      id: replyMessage.id,
      content,
      userId,
      displayName,
      avatarUrl,
      replyToMessageId,
      replyTo,
      createdAt: replyMessage.createdAt,
    };
  }

  // =========================================================================
  // DELETE MESSAGE (HARD DELETE)
  // =========================================================================

  /**
   * Hard-delete a message with permission checks.
   * Also removes associated S3 images.
   * - USER can delete own messages
   * - OWNER can delete own + ASSISTANT messages
   */
  async deleteMessage(
    userId: string,
    dto: { conversationId: string; messageId: string },
  ): Promise<{
    messageId: string;
    conversationId: string;
  }> {
    const { conversationId, messageId } = dto;

    // Verify conversation
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Get message (include imageUrl for S3 cleanup)
    const message = await this.prisma.message.findUnique({
      where: { id: messageId, conversationId },
      select: {
        id: true,
        userId: true,
        role: true,
        imageUrl: true,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Permission check
    let isOwner = false;
    if (conversation.isCollaborative) {
      const { hasAccess, role } = await this.sessionService.checkAccess(
        userId,
        conversationId,
      );
      if (!hasAccess) {
        throw new ForbiddenException('You are not a member of this session');
      }
      isOwner = role === 'OWNER';
    } else {
      if (conversation.userId !== userId) {
        throw new ForbiddenException('Not authorized');
      }
      isOwner = true; // Single-user conversation owner
    }

    const isOwnMessage = message.userId === userId;
    const isAssistantMessage = message.role === 'ASSISTANT';

    if (!isOwnMessage && !(isOwner && isAssistantMessage)) {
      throw new ForbiddenException(
        'You can only delete your own messages' +
        (isOwner ? ' or assistant messages' : ''),
      );
    }

    // Delete S3 image if present
    if (message.imageUrl) {
      try {
        await this.s3Service.deleteFile(message.imageUrl);
      } catch (err) {
        // Log but don't fail the delete operation
        console.error('Failed to delete S3 image:', err);
      }
    }

    // Hard delete the message (cascades to reactions via DB FK)
    await this.prisma.message.delete({
      where: { id: messageId },
    });

    // Broadcast via WebSocket
    this.sessionGateway.broadcastMessageDeleted(conversationId, {
      messageId,
      userId,
    });

    return {
      messageId,
      conversationId,
    };
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  /**
   * Auto-generate a title for a conversation based on the first user message.
  /**
   * Load custom prompts from admin config DB.
   * Returns a map of prompt keys to prompt text.
   */
  private async loadCustomPrompts(): Promise<Record<string, string>> {
    try {
      const promptKeys = ['prompt.rag_instructions', 'prompt.condense_question', 'prompt.region_explain'];
      const configs = await this.prisma.systemConfig.findMany({
        where: { key: { in: promptKeys } },
        select: { key: true, value: true },
      });

      const prompts: Record<string, string> = {};
      for (const c of configs) {
        const val = c.value as any;
        if (val?.text) {
          // Map 'prompt.rag_instructions' -> 'rag_instructions'
          const shortKey = c.key.replace('prompt.', '');
          prompts[shortKey] = val.text;
        }
      }
      return prompts;
    } catch (err) {
      this.logger.warn(`[Prompts] Failed to load custom prompts: ${err}`);
      return {};
    }
  }

  /**
   * Update rolling memory summary if conversation exceeds window size.
   * Loads overflow messages (those pushed out of the window),
   * calls RAG to summarize them with the old summary, and saves to DB.
   * Fire-and-forget — never throws (errors are logged).
   */
  private async updateMemorySummaryIfNeeded(
    conversationId: string,
    totalMsgCount: number,
    windowSize: number,
    oldSummary: string,
  ): Promise<void> {
    // Only update if we have messages beyond the window
    if (totalMsgCount <= windowSize) return;

    try {
      // Load the overflow messages (those that just fell out of the window)
      const overflowCount = Math.min(totalMsgCount - windowSize, windowSize);
      const overflowMessages = await this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip: Math.max(0, totalMsgCount - windowSize - overflowCount),
        take: overflowCount,
        select: { role: true, content: true },
      });

      if (overflowMessages.length === 0) return;

      const overflowForRag = overflowMessages.map(m => ({
        role: m.role === 'USER' ? 'user' : 'assistant',
        content: m.content || '',
      }));

      // Call RAG to summarize
      const newSummary = await this.ragService.summarizeMemory(
        oldSummary,
        overflowForRag,
      );

      if (newSummary && newSummary !== oldSummary) {
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { memorySummary: newSummary },
        });
        this.logger.log(`[Memory] Summary updated for conversation ${conversationId} (${newSummary.length} chars)`);
      }
    } catch (err) {
      this.logger.warn(`[Memory] Failed to update summary: ${err}`);
    }
  }

  /**
   * Only triggers when the conversation title is still the default value.
   * Fire-and-forget — never throws.
   */
  private async autoGenerateTitleIfNeeded(
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
            where: { role: MessageRole.USER },
            orderBy: { createdAt: 'asc' },
            take: 2, // fetch 2 to check if this is truly the first
            select: { content: true },
          },
        },
      });

      if (!conv) return;

      // Only run on first user message
      if ((conv as any).messages?.length !== 1) return;

      // Only run when title is still default
      const defaultTitles = ['New conversation', null, ''];
      if (!defaultTitles.includes(conv.title ?? '')) return;

      const firstMsg = (conv as any).messages[0]?.content || '';
      if (!firstMsg) return;

      const paperTitle =
        (conv as any).paper?.title ||
        (conv as any).conversationPapers?.[0]?.paper?.title ||
        '';

      const generated = await this.ragService.generateTitle(paperTitle, firstMsg);

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { title: generated },
      });

      this.logger.log(`Auto-title set for ${conversationId}: "${generated}"`);
    } catch (err) {
      this.logger.warn(`Auto-title skipped for ${conversationId}: ${err?.message}`);
    }
  }
}
