import { ForbiddenException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { ExplainSelectionRequestDto } from './dto/explain-selection-request.dto';
import {
  ExplainSelectionResponseDto,
  ExplainSelectionResultDto,
  SelectionCitationDto,
} from './dto/explain-selection-response.dto';

@Injectable()
export class SelectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
  ) {}

  private mapCitation(raw: any): SelectionCitationDto {
    const c = new SelectionCitationDto();
    c.pageNumber = raw.page_number ?? raw.pageNumber ?? null;
    c.snippet = raw.snippet ?? null;
    c.chunkId = raw.chunk_id ?? raw.chunkId ?? null;
    c.elementId = raw.element_id ?? raw.elementId ?? null;
    c.score = raw.score ?? null;
    return c;
  }

  async explainSelection(
    userId: string,
    dto: ExplainSelectionRequestDto,
  ): Promise<ExplainSelectionResponseDto> {
    const { paperId, pageId } = dto;

    // 1) Check user owns paper
    const paper = await this.prisma.paper.findFirst({
      where: {
        id: paperId,
        owner_user_id: userId,
      },
    });
    if (!paper) {
      throw new ForbiddenException('Paper not found or not owned by user');
    }

    // 2) Tạo (hoặc verify) conversation
    let conversationId = dto.conversationId;
    if (conversationId) {
      const conv = await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          user_id: userId,
          paper_id: paperId,
        },
      });
      if (!conv) {
        throw new ForbiddenException(
          'Conversation not found or not owned by user',
        );
      }
    } else {
      const conv = await this.prisma.conversation.create({
        data: {
          user_id: userId,
          paper_id: paperId,
          title: paper.title ?? 'Explain selection',
          mode: 'novice',
        },
      });
      conversationId = conv.id;
    }

    // 3) Insert selection_region
    const selection = await this.prisma.selection_region.create({
      data: {
        paper_id: paperId,
        page_id: pageId,
        selection_type: dto.selectionType,
        bbox_x: dto.bboxX,
        bbox_y: dto.bboxY,
        bbox_width: dto.bboxWidth,
        bbox_height: dto.bboxHeight,
        image_path: dto.imageUrl ?? null,
        extracted_text: dto.extractedText ?? null,
        created_by_user: userId,
        created_source: 'user_crop',
      },
    });

    // 4) Tạo message user + qa_turn (system câu hỏi fixed)
    const userMessage = await this.prisma.message.create({
      data: {
        conversation_id: conversationId,
        role: 'user',
        content: '[ExplainSelection] User selected a region on the PDF',
      },
    });

    const qaTurn = await this.prisma.qa_turn.create({
      data: {
        conversation_id: conversationId,
        user_message_id: userMessage.id,
        mode_snapshot: dto.audienceLevel,
      },
    });

    // 5) Gọi Python RAG service
    const url = process.env.RAG_SELECTION_URL;
    if (!url) {
      throw new Error('RAG_SELECTION_URL is not configured');
    }

    const ragRes = await this.http.axiosRef.post(url, {
      selection_region_id: selection.id,
      paper_id: paperId,
      page_id: pageId,
      selection_type: dto.selectionType,
      audience_level: dto.audienceLevel,
      qa_turn_id: qaTurn.id,
    });

    const rag = ragRes.data;
    const answer = rag.answer ?? '';
    const citationsRaw: any[] = rag.citations ?? [];

    // 6) Lưu assistant message + update qa_turn
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversation_id: conversationId,
        role: 'assistant',
        content: answer,
        model_name: rag.model_name ?? 'rag-model',
        token_count: rag.token_output ?? 0,
      },
    });

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

    // 7) Lưu citations (nếu có)
    if (citationsRaw.length) {
      await Promise.all(
        citationsRaw.map((c) =>
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

    // 8) Nếu Python nói đây là formula -> tạo FormulaInsight
    let formulaInsightId: string | undefined = undefined;
    if (rag.is_formula || rag.variables_json || rag.pipeline_role) {
      const insight = await this.prisma.formula_insight.create({
        data: {
          selection_region_id: selection.id,
          qa_turn_id: qaTurn.id,
          audience_level: dto.audienceLevel,
          variables_json: rag.variables_json ?? {},
          conceptual_explanation: rag.conceptual_explanation ?? '',
          pipeline_role: rag.pipeline_role ?? '',
          assumptions: rag.assumptions ?? null,
          limitations: rag.limitations ?? null,
          model_name: rag.model_name ?? 'rag-model',
        },
      });
      formulaInsightId = insight.id;
    }

    // 9) Build response
    const result = new ExplainSelectionResultDto();
    result.selectionRegionId = selection.id;
    result.qaTurnId = qaTurn.id;
    result.answer = answer;
    result.citations = citationsRaw.map((c) => this.mapCitation(c));
    result.formulaInsightId = formulaInsightId;

    const response = new ExplainSelectionResponseDto();
    response.success = true;
    response.message = 'Selection explained successfully';
    response.data = result;
    return response;
  }
}
