// src/chat/chat.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../upload/s3.service';
import { AskQuestionRequestDto } from './dto/ask-question-request.dto';
import {
  AskQuestionResultDto,
  ChatCitationDto,
} from './dto/ask-question-response.dto';
import {
  AskMultiPaperResultDto,
  MultiPaperSourceDto,
  ConversationPaperDto,
} from './dto/ask-multi-paper-request.dto';
import { MessageItemDto } from './dto/get-messages-response.dto';
import { MessageRole, ConversationType } from '@prisma/client';

interface RagContextItem {
  source_id: string;
  text: string;
  type?: string;
  page?: number;
  metadata?: {
    section_title?: string;
    page_label?: number;
    page_start?: number;
    page_end?: number;
    modality?: string;
    bbox?: any;
    layout_width?: number;
    layout_height?: number;
    [key: string]: any;
  };
  image_b64?: string;
  table_html?: string;
}

interface RagContext {
  texts?: RagContextItem[];
  tables?: RagContextItem[];
  images?: RagContextItem[];
  // Legacy support
  citations?: any[];
  model_name?: string;
  token_count?: number;
  latency_ms?: number;
}

interface RagQueryResponse {
  answer: string;
  context?: RagContext;
}

@Injectable()
export class ChatService {
  private readonly ragServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly s3Service: S3Service,
  ) {
    // Use 127.0.0.1 instead of localhost to avoid IPv6 issues on Windows
    this.ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://127.0.0.1:8000';
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
   * Extract citations from RAG context (texts, tables, images)
   */
  private extractCitationsFromContext(context?: RagContext): any[] {
    if (!context) return [];

    // If RAG already provides citations array, use it
    if (context.citations && Array.isArray(context.citations)) {
      return context.citations;
    }

    // Otherwise, combine texts, tables, images into citations
    const citations: any[] = [];

    // Add texts
    if (context.texts && Array.isArray(context.texts)) {
      citations.push(
        ...context.texts.map((t) => ({
          ...t,
          modality: 'text',
        })),
      );
    }

    // Add tables
    if (context.tables && Array.isArray(context.tables)) {
      citations.push(
        ...context.tables.map((t) => ({
          ...t,
          modality: 'table',
        })),
      );
    }

    // Add images (without base64 to keep response size small)
    if (context.images && Array.isArray(context.images)) {
      citations.push(
        ...context.images.map((img) => ({
          source_id: img.source_id,
          text: img.text,
          type: img.type,
          page: img.page,
          metadata: img.metadata,
          modality: 'image',
          // Don't include image_b64 in response to save bandwidth
        })),
      );
    }

    return citations;
  }

  /**
   * Clean up context before storing in database
   * Removes heavy data like image_b64 to reduce DB size
   */
  private cleanContextForStorage(context?: RagContext): RagContext {
    if (!context) return {};

    return {
      ...context,
      // Remove image_b64 from images array to save DB space
      images: context.images?.map((img) => {
        const { image_b64, ...rest } = img;
        return rest;
      }),
      // Also clean any image_b64 in texts or tables if present
      texts: context.texts?.map((item) => {
        const { image_b64, ...rest } = item;
        return rest;
      }),
      tables: context.tables?.map((item) => {
        const { image_b64, ...rest } = item;
        return rest;
      }),
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

    // 1. Verify conversation ownership and get paper info
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: { paper: true },
    });

    if (!conversation) {
      throw new ForbiddenException(
        'Conversation not found or not owned by user',
      );
    }

    if (!conversation.paper.ragFileId) {
      throw new NotFoundException('Paper has not been processed by RAG system');
    }

    // 2. Create user message
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.USER,
        content: question,
        imageUrl: imageUrl || null,
      },
    });

    // 3. Call RAG service
    let ragResponse: RagQueryResponse;
    try {
      const res = await this.http.axiosRef.post<RagQueryResponse>(
        `${this.ragServiceUrl}/query`,
        {
          file_id: conversation.paper.ragFileId,
          question,
        },
      );
      ragResponse = res.data;
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
    const rawCitations = this.extractCitationsFromContext(ragResponse.context);
    const modelName = ragResponse.context?.model_name || 'rag-model';
    const tokenCount = ragResponse.context?.token_count || 0;

    // 4. Create assistant message with context stored as JSON
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.ASSISTANT,
        content: answerText,
        modelName,
        tokenCount,
        context: this.cleanContextForStorage(ragResponse.context) as any,
      },
    });

    // 5. Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // 6. Build and return raw result
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
  ): Promise<MessageItemDto[]> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        // Include conversationPapers for multi-paper citation mapping
        conversationPapers: {
          include: {
            paper: {
              select: {
                id: true,
                ragFileId: true,
                fileName: true,
                fileUrl: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new ForbiddenException(
        'Conversation not found or not owned by user',
      );
    }

    // Build ragFileId -> paperId mapping for multi-paper citations
    const ragFileIdToPaperId = new Map<string, string>();
    const paperInfoMap = new Map<
      string,
      { fileName: string; fileUrl: string | null }
    >();

    if (conversation.conversationPapers?.length > 0) {
      for (const cp of conversation.conversationPapers) {
        if (cp.paper.ragFileId) {
          ragFileIdToPaperId.set(cp.paper.ragFileId, cp.paper.id);
          paperInfoMap.set(cp.paper.id, {
            fileName: cp.paper.fileName,
            fileUrl: cp.paper.fileUrl,
          });
        }
      }
    }

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        content: true,
        imageUrl: true,
        modelName: true,
        tokenCount: true,
        context: true, // Include context to get citations
        createdAt: true,
      },
    });

    // Map messages and extract citations from context for assistant messages
    return messages.map((msg) => {
      const base: MessageItemDto = {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        imageUrl: msg.imageUrl,
        modelName: msg.modelName,
        tokenCount: msg.tokenCount,
        createdAt: msg.createdAt,
      };

      // Extract citations from context for assistant messages
      if (msg.role === 'ASSISTANT' && msg.context) {
        const context = msg.context as any;
        const rawCitations = this.extractCitationsFromContext(context);
        // Pass the mapping for multi-paper citations
        base.citations = rawCitations.map((c: any) => {
          const citation = this.mapCitation(c, ragFileIdToPaperId);
          // Enrich with paper info
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

    // If conversationId provided, verify ownership
    if (conversationId) {
      conversation = await this.prisma.conversation.findFirst({
        where: { id: conversationId, userId },
        include: { paper: true },
      });

      if (!conversation) {
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
        role: MessageRole.USER,
        content: dto.question || 'Please explain this region.',
        imageUrl: imageUrl,
      },
    });

    // Strip data URL prefix if present (RAG API expects raw base64)
    let rawBase64 = dto.imageBase64;
    if (dto.imageBase64.includes(',')) {
      rawBase64 = dto.imageBase64.split(',')[1];
    }

    // Call RAG explain-region endpoint
    let ragResponse: RagQueryResponse;
    try {
      const res = await this.http.axiosRef.post<RagQueryResponse>(
        `${this.ragServiceUrl}/explain-region`,
        {
          file_id: conversation.paper.ragFileId,
          image_b64: rawBase64,
          page_number: dto.pageNumber,
          question:
            dto.question || 'Please analyze and explain this cropped region.',
        },
      );
      ragResponse = res.data;
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
        context: this.cleanContextForStorage(ragResponse.context) as any,
      },
    });

    // Build and return raw result
    const result = new AskQuestionResultDto();
    result.answer = ragResponse.answer || '';
    result.citations = this.extractCitationsFromContext(
      ragResponse.context,
    ).map((c: any) => this.mapCitation(c));
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

    if (!actualConversationId) {
      // Try to find existing multi-paper conversation for this user
      const existingConv = await this.prisma.conversation.findFirst({
        where: {
          userId,
          type: ConversationType.MULTI_PAPER,
        },
        orderBy: { updatedAt: 'desc' }, // Get the most recent one
      });

      if (existingConv) {
        // Reuse existing multi-paper conversation
        actualConversationId = existingConv.id;

        // Update ConversationPaper entries to reflect current paper selection
        // First, get existing paper IDs in conversation
        const existingPaperIds = await this.prisma.conversationPaper.findMany({
          where: { conversationId: existingConv.id },
          select: { paperId: true },
        });
        const existingPaperIdSet = new Set(
          existingPaperIds.map((p) => p.paperId),
        );

        // Add new papers that aren't already in the conversation
        const newPaperEntries = paperIds
          .filter((pid) => !existingPaperIdSet.has(pid))
          .map((paperId, index) => ({
            conversationId: existingConv.id,
            paperId,
            orderIndex: existingPaperIds.length + index,
          }));

        if (newPaperEntries.length > 0) {
          await this.prisma.conversationPaper.createMany({
            data: newPaperEntries,
          });
        }

        // Update conversation title to reflect current papers
        await this.prisma.conversation.update({
          where: { id: existingConv.id },
          data: {
            title: `Multi-paper: ${papers
              .map((p) => p.fileName)
              .join(', ')
              .substring(0, 100)}`,
          },
        });
      } else {
        // Create a new multi-paper conversation (first time for this user)
        const conv = await this.prisma.conversation.create({
          data: {
            userId,
            paperId: paperIds[0], // Use first paper as primary reference (for backwards compatibility)
            type: ConversationType.MULTI_PAPER,
            title: `Multi-paper: ${papers
              .map((p) => p.fileName)
              .join(', ')
              .substring(0, 100)}`,
          },
        });
        actualConversationId = conv.id;

        // Create ConversationPaper entries for all papers in the conversation
        await this.prisma.conversationPaper.createMany({
          data: paperIds.map((paperId, index) => ({
            conversationId: conv.id,
            paperId,
            orderIndex: index,
          })),
        });
      }
    }

    // 3. Create user message
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId: actualConversationId,
        role: MessageRole.USER,
        content: question,
      },
    });

    // 4. Call RAG service with multi-query endpoint
    let ragResponse: any;
    try {
      const res = await this.http.axiosRef.post(
        `${this.ragServiceUrl}/query-multi`,
        {
          file_ids: fileIds,
          question,
        },
      );
      ragResponse = res.data;
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
    const rawCitations = this.extractCitationsFromContext(ragResponse.context);

    // 5. Create assistant message
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId: actualConversationId,
        role: MessageRole.ASSISTANT,
        content: answerText,
        context: this.cleanContextForStorage(ragResponse.context) as any,
      },
    });

    // 6. Map citations with source paper info
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

    // 7. Map sources to paper info
    const sources = (ragResponse.sources || []).map((s: any) => {
      const paperId = ragFileIdToPaperId.get(s.paper_id) || s.paper_id;
      const paperInfo = paperInfoMap.get(paperId);
      return {
        paperId,
        title: s.title || paperTitles[s.paper_id] || 'Unknown Paper',
        fileUrl: paperInfo?.fileUrl || null,
      };
    });

    // 8. Get all papers in conversation for response
    const conversationPapers: ConversationPaperDto[] = paperIds.map(
      (id, index) => {
        const paperInfo = paperInfoMap.get(id);
        return {
          paperId: id,
          orderIndex: index,
          fileName: paperInfo?.fileName || 'Unknown',
          fileUrl: paperInfo?.fileUrl || null,
        };
      },
    );

    const result = new AskMultiPaperResultDto();
    result.answer = answerText;
    result.citations = mappedCitations;
    result.sources = sources;
    result.conversationPapers = conversationPapers;
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
