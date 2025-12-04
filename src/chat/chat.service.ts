// src/chat/chat.service.ts
import { ForbiddenException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import {
  AskQuestionRequestDto,
  ChatMode,
} from './dto/ask-question-request.dto';
import {
  AskQuestionResponseDto,
  AskQuestionResultDto,
  ChatCitationDto,
} from './dto/ask-question-response.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
  ) {}

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
    const { paperId, conversationId, question, mode } = dto;

    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, user_id: userId, paper_id: paperId },
    });
    if (!conv) {
      throw new ForbiddenException(
        'Conversation not found or not owned by user',
      );
    }
    // 1. Lưu user message
    const userMessage = await this.prisma.message.create({
      data: {
        conversation_id: conversationId,
        role: 'user',
        content: question,
      },
    });

    // 2. Tạo qa_turn
    const qaTurn = await this.prisma.qa_turn.create({
      data: {
        conversation_id: conversationId,
        user_message_id: userMessage.id,
        mode_snapshot: mode ?? ChatMode.novice,
      },
    });

    // 3. Gọi Python RAG
    const ragUrl = process.env.RAG_SERVICE_URL!;
    const res = await this.http.axiosRef.post(ragUrl, {
      paper_id: paperId,
      question,
      mode,
      qa_turn_id: qaTurn.id,
    });

    const rag = res.data;
    const answerText: string = rag.answer ?? '';
    const rawCitations: any[] = rag.citations ?? [];

    // 4. Ghi assistant message
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversation_id: conversationId,
        role: 'assistant',
        content: answerText,
        model_name: rag.model_name ?? 'rag-model',
        token_count: rag.token_output ?? 0,
      },
    });

    // 5. Update qa_turn
    await this.prisma.qa_turn.update({
      where: { id: qaTurn.id },
      data: {
        assistant_message_id: assistantMessage.id,
        latency_ms: rag.latency_ms ?? 0,
        token_input: rag.token_input ?? 0,
        token_output: rag.token_output ?? 0,
        cost_usd: rag.cost_usd ?? 0,
      },
    });

    // 6. Lưu citations
    if (rawCitations.length) {
      await Promise.all(
        rawCitations.map((c) =>
          this.prisma.answer_citation.create({
            data: {
              qa_turn_id: qaTurn.id,
              chunk_id: c.chunk_id ?? null,
              element_id: c.element_id ?? null,
              page_number: c.page_number ?? null,
              source_snippet: c.snippet ?? null,
              relevance_score: c.score ?? null,
              is_primary: c.is_primary ?? null,
            },
          }),
        ),
      );
    }

    // 7. Map RAG → DTO
    const result = new AskQuestionResultDto();
    result.answer = answerText;
    result.citations = rawCitations.map((c) => this.mapCitation(c));
    result.assistantMessageId = assistantMessage.id;
    result.userMessageId = userMessage.id;
    result.qaTurnId = qaTurn.id;

    const response = new AskQuestionResponseDto();
    response.success = true;
    response.message = 'Answer generated';
    response.data = result;

    return response;
  }
}
