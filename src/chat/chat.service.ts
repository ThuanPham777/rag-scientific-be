// src/chat/chat.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { AskQuestionRequestDto } from './dto/ask-question-request.dto';
import {
  AskQuestionResponseDto,
  AskQuestionResultDto,
  ChatCitationDto,
} from './dto/ask-question-response.dto';
import { MessageRole } from '@prisma/client';

interface RagQueryResponse {
  answer: string;
  context?: {
    citations?: any[];
    model_name?: string;
    token_count?: number;
    latency_ms?: number;
  };
}

@Injectable()
export class ChatService {
  private readonly ragServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
  ) {
    // Use 127.0.0.1 instead of localhost to avoid IPv6 issues on Windows
    this.ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://127.0.0.1:8000';
  }

  private mapCitation(raw: any): ChatCitationDto {
    const c = new ChatCitationDto();
    c.pageNumber = raw.page_number ?? raw.pageNumber ?? null;
    c.snippet = raw.snippet ?? null;
    c.elementId = raw.element_id ?? raw.elementId ?? null;
    c.chunkId = raw.chunk_id ?? raw.chunkId ?? null;
    c.score = raw.score ?? null;
    return c;
  }

  async askQuestion(
    userId: string,
    dto: AskQuestionRequestDto,
  ): Promise<AskQuestionResponseDto> {
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
    const rawCitations = ragResponse.context?.citations || [];
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
        context: ragResponse.context || {},
      },
    });

    // 5. Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // 6. Build response
    const result = new AskQuestionResultDto();
    result.answer = answerText;
    result.citations = rawCitations.map((c: any) => this.mapCitation(c));
    result.assistantMessageId = assistantMessage.id;
    result.userMessageId = userMessage.id;
    result.modelName = modelName;
    result.tokenCount = tokenCount;

    const response = new AskQuestionResponseDto();
    response.success = true;
    response.message = 'Answer generated';
    response.data = result;

    return response;
  }

  /**
   * Get message history for a conversation
   */
  async getMessageHistory(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new ForbiddenException(
        'Conversation not found or not owned by user',
      );
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
        createdAt: true,
      },
    });

    return {
      success: true,
      message: 'Messages retrieved',
      data: messages,
    };
  }

  /**
   * Explain a selected region in the PDF
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
  ): Promise<AskQuestionResponseDto> {
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

    // Create user message
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.USER,
        content: dto.question || 'Please explain this region.',
        imageUrl: `data:image/png;base64,${dto.imageBase64.substring(0, 100)}...`,
      },
    });

    // Call RAG explain-region endpoint
    let ragResponse: RagQueryResponse;
    try {
      const res = await this.http.axiosRef.post<RagQueryResponse>(
        `${this.ragServiceUrl}/explain-region`,
        {
          file_id: conversation.paper.ragFileId,
          image_b64: dto.imageBase64,
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
        context: ragResponse.context || {},
      },
    });

    // Build response
    const result = new AskQuestionResultDto();
    result.answer = ragResponse.answer || '';
    result.citations = [];
    result.assistantMessageId = assistantMessage.id;
    result.userMessageId = userMessage.id;
    result.conversationId = conversationId;

    const response = new AskQuestionResponseDto();
    response.success = true;
    response.message = 'Region explained';
    response.data = result;

    return response;
  }
}
