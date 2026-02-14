// src/chat/chat.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ragService: RagService,
    private readonly s3Service: S3Service,
    private readonly sessionService: SessionService,
    private readonly sessionGateway: SessionGateway,
  ) {}

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

    // 4. Strip @Assistant prefix for RAG query (keep original in stored message)
    const ragQuestion = question.replace(/^@Assistant\s*/i, '').trim();

    // 5. Call RAG service via centralized RagService
    let ragResponse;
    try {
      ragResponse = await this.ragService.query(
        conversation.paper.ragFileId,
        ragQuestion,
      );
    } catch (error) {
      // Create error message and throw
      await this.prisma.message.create({
        data: {
          conversationId,
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

    // 7b. Broadcast to collaborative session if applicable
    if (conversation.isCollaborative) {
      // Broadcast user message
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

      // Broadcast assistant message
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
        user: conversation.isCollaborative
          ? { select: { displayName: true, avatarUrl: true } }
          : false,
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
      await this.prisma.message.create({
        data: {
          conversationId,
          role: MessageRole.ASSISTANT,
          content: 'Sorry, I encountered an error analyzing this region.',
        },
      });
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

    // Build and return raw result
    // Broadcast to collaborative session if applicable
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
      paperIds: string[];
      question: string;
      conversationId?: string;
    },
  ): Promise<AskMultiPaperResultDto> {
    const { paperIds, question, conversationId } = dto;

    // 1. Verify all papers belong to user and have ragFileId
    const papers = await this.prisma.paper.findMany({
      where: {
        id: { in: paperIds },
        userId,
      },
    });

    if (papers.length !== paperIds.length) {
      throw new ForbiddenException(
        'Some papers not found or not owned by user',
      );
    }

    const fileIds: string[] = [];
    const paperTitles: Record<string, string> = {};
    // Map ragFileId -> paperId for citation mapping
    const ragFileIdToPaperId = new Map<string, string>();
    // Map paperId -> paper info for citation enrichment
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

    // 2. Handle conversation - ONE persistent multi-paper conversation per user
    let actualConversationId = conversationId;

    if (actualConversationId) {
      // Verify ownership when conversationId is provided
      const existingConv = await this.prisma.conversation.findFirst({
        where: {
          id: actualConversationId,
          userId,
          type: ConversationType.MULTI_PAPER,
        },
      });

      if (!existingConv) {
        throw new ForbiddenException(
          'Conversation not found or not owned by user',
        );
      }
    } else {
      // Try to find existing multi-paper conversation for this user
      const existingConv = await this.prisma.conversation.findFirst({
        where: {
          userId,
          type: ConversationType.MULTI_PAPER,
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (existingConv) {
        actualConversationId = existingConv.id;
      } else {
        // Create a new multi-paper conversation (first time for this user)
        // paperId is null for multi-paper conversations
        const conv = await this.prisma.conversation.create({
          data: {
            user: { connect: { id: userId } },
            type: ConversationType.MULTI_PAPER,
            title: 'Multi-paper chat',
          },
        });
        actualConversationId = conv.id;
      }
    }

    // 3. Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: actualConversationId },
      data: {
        updatedAt: new Date(),
      },
    });

    // 4. Create user message
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId: actualConversationId,
        role: MessageRole.USER,
        content: question,
      },
    });

    // 5. Call RAG service with multi-query endpoint via centralized RagService
    let ragResponse;
    try {
      ragResponse = await this.ragService.queryMulti(fileIds, question);
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

    return result;
  }

  /**
   * Clear chat history for a conversation
   */
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
}
