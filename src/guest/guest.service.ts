// src/guest/guest.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { S3Service } from '../upload/s3.service';
import {
  GuestUploadResultDto,
  GuestAskQuestionDto,
  GuestAskQuestionResultDto,
  GuestCitationDto,
  GuestExplainRegionDto,
} from './dto/guest.dto';

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
  citations?: any[];
  model_name?: string;
  token_count?: number;
}

interface RagQueryResponse {
  answer: string;
  context?: RagContext;
}

@Injectable()
export class GuestService {
  private readonly ragServiceUrl: string;
  // In-memory store for ingest status (in production, use Redis)
  private readonly ingestStatus: Map<
    string,
    'PROCESSING' | 'COMPLETED' | 'FAILED'
  > = new Map();

  constructor(
    private readonly http: HttpService,
    private readonly s3Service: S3Service,
  ) {
    this.ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://127.0.0.1:8000';
  }

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
   * Ingest file in background
   */
  private async ingestInBackground(
    ragFileId: string,
    fileUrl: string,
  ): Promise<void> {
    try {
      await this.http.axiosRef.post(`${this.ragServiceUrl}/ingest-from-url`, {
        file_url: fileUrl,
        file_id: ragFileId,
      });
      this.ingestStatus.set(ragFileId, 'COMPLETED');
      console.log(`✅ Ingest completed for ${ragFileId}`);
    } catch (error) {
      console.error(`❌ Ingest failed for ${ragFileId}:`, error);
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

    // Call RAG service
    let ragResponse: RagQueryResponse;
    try {
      const res = await this.http.axiosRef.post<RagQueryResponse>(
        `${this.ragServiceUrl}/query`,
        {
          file_id: ragFileId,
          question,
        },
      );
      ragResponse = res.data;
    } catch (error) {
      console.error('RAG query failed for guest:', error);
      throw new BadRequestException(
        'Failed to process your question. Please try again.',
      );
    }

    const answerText = ragResponse.answer || '';
    const rawCitations = this.extractCitationsFromContext(ragResponse.context);

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

    // Strip data URL prefix if present (RAG API expects raw base64)
    let rawBase64 = imageBase64;
    if (imageBase64.includes(',')) {
      rawBase64 = imageBase64.split(',')[1];
    }

    // Call RAG service with image
    let ragResponse: RagQueryResponse;
    try {
      const res = await this.http.axiosRef.post<RagQueryResponse>(
        `${this.ragServiceUrl}/explain-region`,
        {
          file_id: ragFileId,
          question: prompt,
          image_b64: rawBase64,
          page_number: pageNumber,
        },
      );
      ragResponse = res.data;
    } catch (error) {
      console.error('RAG explain region failed for guest:', error);
      throw new BadRequestException('Failed to explain the selected region.');
    }

    const answerText = ragResponse.answer || '';
    const rawCitations = this.extractCitationsFromContext(ragResponse.context);

    const result = new GuestAskQuestionResultDto();
    result.answer = answerText;
    result.citations = rawCitations.map((c: any) => this.mapCitation(c));
    result.modelName = ragResponse.context?.model_name || 'rag-model';
    result.tokenCount = ragResponse.context?.token_count || 0;

    return result;
  }

  /**
   * Extract citations from RAG context
   */
  private extractCitationsFromContext(context?: RagContext): any[] {
    if (!context) return [];

    if (context.citations && Array.isArray(context.citations)) {
      return context.citations;
    }

    const citations: any[] = [];

    if (context.texts && Array.isArray(context.texts)) {
      citations.push(...context.texts.map((t) => ({ ...t, modality: 'text' })));
    }

    if (context.tables && Array.isArray(context.tables)) {
      citations.push(
        ...context.tables.map((t) => ({ ...t, modality: 'table' })),
      );
    }

    if (context.images && Array.isArray(context.images)) {
      citations.push(
        ...context.images.map((img) => ({
          source_id: img.source_id,
          text: img.text,
          type: img.type,
          page: img.page,
          metadata: img.metadata,
          modality: 'image',
        })),
      );
    }

    return citations;
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
}
