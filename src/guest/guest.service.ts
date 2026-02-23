// src/guest/guest.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { S3Service } from '../upload/s3.service';
import { RagService } from '../rag/index';
import { PrismaService } from '../prisma/prisma.service';
import {
  GuestUploadResultDto,
  GuestAskQuestionDto,
  GuestAskQuestionResultDto,
  GuestCitationDto,
  GuestExplainRegionDto,
  GuestMigrateRequestDto,
  GuestMigrateResultDto,
} from './dto/guest.dto';
import { MessageRole, ConversationType } from '../../generated/prisma/client';

@Injectable()
export class GuestService {
  private readonly logger = new Logger(GuestService.name);
  // In-memory store for ingest status (in production, use Redis)
  private readonly ingestStatus: Map<
    string,
    'PROCESSING' | 'COMPLETED' | 'FAILED'
  > = new Map();

  constructor(
    private readonly ragService: RagService,
    private readonly s3Service: S3Service,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Upload PDF for guest user - uploads to S3 and starts ingest in background
   * Returns immediately after S3 upload
   */
  async uploadPdf(file: Express.Multer.File): Promise<GuestUploadResultDto> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new BadRequestException('File is too large (max 50MB)');
    }

    // 1. Upload to S3
    const s3Result = await this.s3Service.uploadFile(
      file.buffer,
      file.originalname,
      'pdf', // Same folder as regular uploads
      file.mimetype,
    );

    // 2. Generate IDs (same format as authenticated users)
    const paperId = crypto.randomUUID();
    const ragFileId = crypto.randomUUID();

    // 3. Set initial status and start background ingest
    this.ingestStatus.set(ragFileId, 'PROCESSING');

    // Start ingest in background (don't await)
    this.ingestInBackground(ragFileId, s3Result.url);

    return {
      paperId,
      ragFileId,
      fileName: file.originalname,
      fileUrl: s3Result.url,
      status: 'PROCESSING',
    };
  }

  /**
   * Ingest file in background via centralized RagService
   */
  private async ingestInBackground(
    ragFileId: string,
    fileUrl: string,
  ): Promise<void> {
    try {
      await this.ragService.ingestFromUrl(fileUrl, ragFileId);
      this.ingestStatus.set(ragFileId, 'COMPLETED');
      this.logger.log(`✅ Ingest completed for ${ragFileId}`);
    } catch (error) {
      this.logger.error(`❌ Ingest failed for ${ragFileId}:`, error);
      this.ingestStatus.set(ragFileId, 'FAILED');
    }
  }

  /**
   * Check ingest status
   */
  getIngestStatus(ragFileId: string): 'PROCESSING' | 'COMPLETED' | 'FAILED' {
    return this.ingestStatus.get(ragFileId) || 'COMPLETED';
  }

  /**
   * Ask question for guest user - queries RAG directly
   * No message history is saved to database
   */
  async askQuestion(
    dto: GuestAskQuestionDto,
  ): Promise<GuestAskQuestionResultDto> {
    const { ragFileId, question } = dto;

    // Check if still processing
    const status = this.getIngestStatus(ragFileId);
    if (status === 'PROCESSING') {
      throw new BadRequestException(
        'PDF is still being processed. Please wait a moment.',
      );
    }
    if (status === 'FAILED') {
      throw new BadRequestException(
        'PDF processing failed. Please try uploading again.',
      );
    }

    // Call RAG service via centralized RagService
    let ragResponse;
    try {
      ragResponse = await this.ragService.query(ragFileId, question);
    } catch (error) {
      this.logger.error('RAG query failed for guest:', error);
      throw new BadRequestException(
        'Failed to process your question. Please try again.',
      );
    }

    const answerText = ragResponse.answer || '';
    const rawCitations = this.ragService.extractCitationsFromContext(
      ragResponse.context,
    );

    const result = new GuestAskQuestionResultDto();
    result.answer = answerText;
    result.citations = rawCitations.map((c: any) => this.mapCitation(c));
    result.modelName = ragResponse.context?.model_name || 'rag-model';
    result.tokenCount = ragResponse.context?.token_count || 0;

    return result;
  }

  /**
   * Explain region for guest user
   */
  async explainRegion(
    dto: GuestExplainRegionDto,
  ): Promise<GuestAskQuestionResultDto> {
    const { ragFileId, imageBase64, pageNumber, question } = dto;

    // Check if still processing
    const status = this.getIngestStatus(ragFileId);
    if (status === 'PROCESSING') {
      throw new BadRequestException(
        'PDF is still being processed. Please wait a moment.',
      );
    }
    if (status === 'FAILED') {
      throw new BadRequestException(
        'PDF processing failed. Please try uploading again.',
      );
    }

    // Build prompt for region explanation
    const prompt =
      question ||
      'Please explain what is shown in this selected region of the document.';

    // Call RAG service with image via centralized RagService
    let ragResponse;
    try {
      ragResponse = await this.ragService.explainRegion(
        ragFileId,
        prompt,
        imageBase64,
        pageNumber,
      );
    } catch (error) {
      this.logger.error('RAG explain region failed for guest:', error);
      throw new BadRequestException('Failed to explain the selected region.');
    }

    const answerText = ragResponse.answer || '';
    const rawCitations = this.ragService.extractCitationsFromContext(
      ragResponse.context,
    );

    const result = new GuestAskQuestionResultDto();
    result.answer = answerText;
    result.citations = rawCitations.map((c: any) => this.mapCitation(c));
    result.modelName = ragResponse.context?.model_name || 'rag-model';
    result.tokenCount = ragResponse.context?.token_count || 0;

    return result;
  }

  /**
   * Map raw citation to DTO
   */
  private mapCitation(raw: any): GuestCitationDto {
    const c = new GuestCitationDto();
    c.pageNumber = raw.page_number ?? raw.pageNumber ?? raw.page ?? null;
    c.snippet = raw.snippet ?? raw.text ?? null;
    c.sourceId = raw.source_id ?? raw.sourceId ?? null;
    c.sectionTitle =
      raw.section_title ?? raw.type ?? raw.metadata?.section_title ?? null;
    c.bbox = raw.bbox ?? raw.metadata?.bbox ?? null;
    c.layoutWidth = raw.layout_width ?? raw.metadata?.layout_width ?? null;
    c.layoutHeight = raw.layout_height ?? raw.metadata?.layout_height ?? null;
    return c;
  }

  // ============================================================
  // Guest → Authenticated Migration
  // ============================================================

  /**
   * Migrate guest data to authenticated user's account.
   * Creates Paper + Conversation + Messages + SuggestedQuestions in a single transaction.
   *
   * The RAG file was already ingested during guest upload, so we only need to
   * create the DB records (no re-ingest needed).
   */
  async migrate(
    userId: string,
    dto: GuestMigrateRequestDto,
  ): Promise<GuestMigrateResultDto> {
    const { ragFileId, fileName, fileUrl, folderId, messages, suggestions } =
      dto;

    // Validate the ragFileId exists in RAG (check ingest status)
    const status = this.getIngestStatus(ragFileId);
    if (status === 'PROCESSING') {
      throw new BadRequestException(
        'PDF is still being processed. Please wait before migrating.',
      );
    }

    // Validate folderId ownership if provided
    if (folderId) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: folderId },
      });
      if (!folder || folder.userId !== userId) {
        throw new BadRequestException('Folder not found or not owned by user');
      }
    }

    // Check if this ragFileId was already migrated (prevent double migration)
    const existingPaper = await this.prisma.paper.findUnique({
      where: { ragFileId },
    });
    if (existingPaper) {
      // Already migrated — return existing IDs instead of duplicating
      const existingConv = await this.prisma.conversation.findFirst({
        where: { paperId: existingPaper.id, userId },
      });
      return {
        paperId: existingPaper.id,
        conversationId: existingConv?.id ?? '',
        messageCount: messages.length,
        suggestionCount: suggestions?.length ?? 0,
      };
    }

    // Perform migration in a single transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create Paper record
      const paper = await tx.paper.create({
        data: {
          userId,
          folderId: folderId || null,
          fileName,
          fileUrl,
          ragFileId,
          status: status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
          processedAt: status === 'COMPLETED' ? new Date() : undefined,
        },
      });

      // 2. Create Conversation
      const conversation = await tx.conversation.create({
        data: {
          userId,
          paperId: paper.id,
          type: ConversationType.SINGLE_PAPER,
          title: fileName.replace(/\.pdf$/i, '') || 'Guest conversation',
        },
      });

      // 3. Create Messages (preserve chronological order)
      let messageCount = 0;
      for (const msg of messages) {
        const role =
          msg.role === 'assistant' ? MessageRole.ASSISTANT : MessageRole.USER;

        await tx.message.create({
          data: {
            conversationId: conversation.id,
            userId: role === MessageRole.USER ? userId : null,
            role,
            content: msg.content,
            imageUrl: msg.imageUrl || null,
            modelName: msg.modelName || null,
            tokenCount: msg.tokenCount || null,
            context: msg.citations ? { citations: msg.citations } : {},
            createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
          },
        });
        messageCount++;
      }

      // 4. Create Suggested Questions (if any)
      let suggestionCount = 0;
      if (suggestions && suggestions.length > 0) {
        for (const question of suggestions) {
          await tx.suggestedQuestion.create({
            data: {
              conversationId: conversation.id,
              question,
            },
          });
          suggestionCount++;
        }
      }

      return {
        paperId: paper.id,
        conversationId: conversation.id,
        messageCount,
        suggestionCount,
      };
    });

    // Clean up in-memory ingest status (no longer needed)
    this.ingestStatus.delete(ragFileId);

    this.logger.log(
      `✅ Guest migration completed: paper=${result.paperId}, conv=${result.conversationId}, msgs=${result.messageCount}`,
    );

    // Trigger background metadata extraction from RAG
    // (title, abstract, authors, etc. — same as paper.service.triggerRagIngestion)
    this.enrichPaperMetadata(result.paperId, ragFileId);

    return result;
  }

  /**
   * Enrich paper metadata from RAG in background (non-blocking).
   * Fetches title, abstract, authors etc. from the already-ingested RAG data.
   */
  private async enrichPaperMetadata(
    paperId: string,
    ragFileId: string,
  ): Promise<void> {
    try {
      // Query RAG for a summary to extract metadata
      const summaryResponse = await this.ragService.summarizePaper(ragFileId);

      if (summaryResponse.summary) {
        await this.prisma.paper.update({
          where: { id: paperId },
          data: {
            summary: summaryResponse.summary,
          },
        });
        this.logger.log(`📝 Paper metadata enriched for ${paperId}`);
      }
    } catch (error) {
      // Non-critical — metadata enrichment is best-effort
      this.logger.warn(
        `⚠️ Paper metadata enrichment failed for ${paperId}: ${error.message}`,
      );
    }
  }
}
