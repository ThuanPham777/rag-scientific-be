// src/rag/rag.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import {
  RagQueryResponse,
  RagIngestResponse,
  RagOrphanedGuestFile,
  RagContext,
  RagContextItem,
} from './dto';

/**
 * RagService - Centralized service for all RAG API communications
 *
 * This service handles all HTTP calls to the RAG (Python FastAPI) service,
 * providing a clean abstraction layer between business logic and RAG integration.
 *
 * Supported operations:
 * - ingestFromUrl: Ingest a PDF from URL
 * - query: Query a single paper
 * - queryMulti: Query multiple papers
 * - explainRegion: Explain a selected region with image
 * - cleanup: Delete RAG data for a paper
 * - getOrphanedGuestFiles: Get list of orphaned guest files for cleanup
 */
@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly ragUrl: string;

  constructor(private readonly http: HttpService) {
    // Use 127.0.0.1 instead of localhost to avoid IPv6 issues on Windows
    this.ragUrl = process.env.RAG_SERVICE_URL ?? 'http://127.0.0.1:8000';
    this.logger.log(`RAG Service URL: ${this.ragUrl}`);
  }

  /**
   * Ingest a PDF from URL into the RAG system
   * @param fileUrl - URL of the PDF file (e.g., S3 URL)
   * @param fileId - Unique identifier for the file in RAG system
   * @returns Ingest response with metadata
   */
  async ingestFromUrl(
    fileUrl: string,
    fileId: string,
  ): Promise<RagIngestResponse> {
    this.logger.debug(`Ingesting file: ${fileId} from ${fileUrl}`);

    const response = await this.http.axiosRef.post<RagIngestResponse>(
      `${this.ragUrl}/ingest-from-url`,
      {
        file_url: fileUrl,
        file_id: fileId,
      },
    );

    return response.data;
  }

  /**
   * Query a single paper
   * @param fileId - RAG file ID of the paper
   * @param question - User's question
   * @returns Query response with answer and context
   */
  async query(fileId: string, question: string): Promise<RagQueryResponse> {
    this.logger.debug(`Querying file: ${fileId} with question: ${question}`);

    const response = await this.http.axiosRef.post<RagQueryResponse>(
      `${this.ragUrl}/query`,
      {
        file_id: fileId,
        question,
      },
    );

    return response.data;
  }

  /**
   * Query multiple papers at once
   * @param fileIds - Array of RAG file IDs
   * @param question - User's question
   * @returns Query response with answer, context, and sources
   */
  async queryMulti(
    fileIds: string[],
    question: string,
  ): Promise<RagQueryResponse> {
    this.logger.debug(
      `Querying multi files: ${fileIds.join(', ')} with question: ${question}`,
    );

    const response = await this.http.axiosRef.post<RagQueryResponse>(
      `${this.ragUrl}/query-multi`,
      {
        file_ids: fileIds,
        question,
      },
    );

    return response.data;
  }

  /**
   * Explain a selected region in a PDF using image
   * @param fileId - RAG file ID of the paper
   * @param question - Question about the region
   * @param imageBase64 - Base64 encoded image of the region
   * @param pageNumber - Optional page number where the region is located
   * @returns Query response with explanation
   */
  async explainRegion(
    fileId: string,
    question: string,
    imageBase64: string,
    pageNumber?: number,
  ): Promise<RagQueryResponse> {
    this.logger.debug(
      `Explaining region in file: ${fileId}, page: ${pageNumber}`,
    );

    // Strip data URL prefix if present (RAG API expects raw base64)
    let rawBase64 = imageBase64;
    if (imageBase64.includes(',')) {
      rawBase64 = imageBase64.split(',')[1];
    }

    const response = await this.http.axiosRef.post<RagQueryResponse>(
      `${this.ragUrl}/explain-region`,
      {
        file_id: fileId,
        question,
        image_b64: rawBase64,
        page_number: pageNumber,
      },
    );

    return response.data;
  }

  /**
   * Delete RAG data for a paper (vector store entries, caches, etc.)
   * @param ragFileId - RAG file ID to cleanup
   */
  async cleanup(ragFileId: string): Promise<void> {
    this.logger.debug(`Cleaning up RAG data for: ${ragFileId}`);

    await this.http.axiosRef.delete(`${this.ragUrl}/cleanup/${ragFileId}`);

    this.logger.log(`RAG cleanup completed for: ${ragFileId}`);
  }

  /**
   * Get list of orphaned guest files for cleanup
   * @param maxAgeHours - Maximum age in hours for files to be considered orphaned
   * @returns Array of orphaned guest files
   */
  async getOrphanedGuestFiles(
    maxAgeHours: number,
  ): Promise<RagOrphanedGuestFile[]> {
    this.logger.debug(
      `Getting orphaned guest files older than ${maxAgeHours} hours`,
    );

    const response = await this.http.axiosRef.get(
      `${this.ragUrl}/cleanup/orphaned-guests`,
      {
        params: { max_age_hours: maxAgeHours },
      },
    );

    return response.data.files || [];
  }

  // ============================================================
  // Helper methods for processing RAG context
  // ============================================================

  /**
   * Extract citations from RAG context (texts, tables, images)
   * Combines all context items into a unified citations array
   */
  extractCitationsFromContext(context?: RagContext): RagContextItem[] {
    if (!context) return [];

    // If RAG already provides citations array, use it
    if (context.citations && Array.isArray(context.citations)) {
      return context.citations;
    }

    // Otherwise, combine texts, tables, images into citations
    const citations: RagContextItem[] = [];

    // Add texts
    if (context.texts && Array.isArray(context.texts)) {
      citations.push(
        ...context.texts.map((t) => ({
          ...t,
          metadata: { ...t.metadata, modality: 'text' },
        })),
      );
    }

    // Add tables
    if (context.tables && Array.isArray(context.tables)) {
      citations.push(
        ...context.tables.map((t) => ({
          ...t,
          metadata: { ...t.metadata, modality: 'table' },
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
          metadata: { ...img.metadata, modality: 'image' },
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
  cleanContextForStorage(context?: RagContext): RagContext {
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
}
