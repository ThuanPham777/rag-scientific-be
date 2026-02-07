import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../upload/s3.service';
import { RagService } from '../rag';
import { CreatePaperRequestDto } from './dto/create-paper-request.dto';
import { PaperItemDto } from './dto/create-paper-response.dto';

@Injectable()
export class PaperService {
  private readonly logger = new Logger(PaperService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragService: RagService,
    private readonly s3Service: S3Service,
  ) {}

  private mapToPaperItem(p: any): PaperItemDto {
    const dto = new PaperItemDto();
    dto.id = p.id;
    dto.ragFileId = p.ragFileId;
    dto.fileName = p.fileName;
    dto.fileUrl = p.fileUrl;
    dto.fileSize = p.fileSize ? Number(p.fileSize) : null;
    dto.title = p.title ?? null;
    dto.abstract = p.abstract ?? null;
    dto.authors = p.authors ?? null;
    dto.numPages = p.numPages ?? null;
    dto.status = p.status;
    dto.nodeCount = p.nodeCount ?? null;
    dto.tableCount = p.tableCount ?? null;
    dto.imageCount = p.imageCount ?? null;
    dto.createdAt = p.createdAt;
    dto.processedAt = p.processedAt ?? null;
    return dto;
  }

  /**
   * Create a new paper and trigger RAG ingestion
   * @returns Raw paper item
   */
  async createPaper(
    userId: string,
    dto: CreatePaperRequestDto,
  ): Promise<PaperItemDto> {
    // Generate ragFileId (UUID for RAG service)
    const ragFileId = crypto.randomUUID();

    const paper = await this.prisma.paper.create({
      data: {
        userId,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        fileSize: dto.fileSize ? BigInt(dto.fileSize) : null,
        fileHash: dto.fileHash,
        ragFileId,
        status: 'PENDING',
        folderId: dto.folderId || null,
      },
    });

    // Call RAG service to ingest the PDF
    this.triggerRagIngestion(paper.id, ragFileId, dto.fileUrl);

    return this.mapToPaperItem(paper);
  }

  private async triggerRagIngestion(
    paperId: string,
    ragFileId: string,
    fileUrl: string,
  ) {
    try {
      // Update status to PROCESSING
      await this.prisma.paper.update({
        where: { id: paperId },
        data: { status: 'PROCESSING' },
      });

      // Call RAG service via centralized RagService
      const response = await this.ragService.ingestFromUrl(fileUrl, ragFileId);

      // Update paper with metadata from RAG
      // Note: authors comes as array from RAG, serialize to JSON string for storage
      const authorsJson = Array.isArray(response.authors)
        ? JSON.stringify(response.authors)
        : response.authors || null;

      await this.prisma.paper.update({
        where: { id: paperId },
        data: {
          status: 'COMPLETED',
          title: response.title,
          abstract: response.abstract,
          authors: authorsJson,
          numPages: response.num_pages,
          nodeCount: response.node_count,
          tableCount: response.table_count,
          imageCount: response.image_count,
          processedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('RAG ingestion failed:', error);
      await this.prisma.paper.update({
        where: { id: paperId },
        data: {
          status: 'FAILED',
          errorMessage: error.message ?? 'RAG ingestion failed',
        },
      });
    }
  }

  /**
   * List all papers for a user
   * @returns Raw array of papers
   */
  async listMyPapers(userId: string): Promise<PaperItemDto[]> {
    const papers = await this.prisma.paper.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return papers.map((p) => this.mapToPaperItem(p));
  }

  /**
   * Get paper by ID
   * @returns Raw paper item
   */
  async getPaperById(userId: string, id: string): Promise<PaperItemDto> {
    const paper = await this.prisma.paper.findFirst({
      where: { id, userId },
    });

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    return this.mapToPaperItem(paper);
  }

  /**
   * Get paper by RAG file ID
   * @returns Raw paper item
   */
  async getPaperByRagFileId(
    userId: string,
    ragFileId: string,
  ): Promise<PaperItemDto> {
    const paper = await this.prisma.paper.findFirst({
      where: { ragFileId, userId },
    });

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    return this.mapToPaperItem(paper);
  }

  /**
   * Delete a paper and cleanup all associated resources
   * - Deletes from database (cascades to conversations, messages, etc.)
   * - Deletes file from S3
   * - Calls RAG service to cleanup vector store and caches
   */
  async deletePaper(userId: string, id: string): Promise<void> {
    const paper = await this.prisma.paper.findFirst({
      where: { id, userId },
    });

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    // 1. Delete from database (cascades to related tables)
    await this.prisma.paper.delete({ where: { id } });

    // 2. Delete file from S3 (async, don't block)
    this.deleteS3File(paper.fileUrl);

    // 3. Call RAG to cleanup vector store and caches (async, don't block)
    this.cleanupRagData(paper.ragFileId);
  }

  /**
   * Delete S3 file in background
   */
  private async deleteS3File(fileUrl: string): Promise<void> {
    try {
      const deleted = await this.s3Service.deleteFile(fileUrl);
      if (deleted) {
        this.logger.log(`Deleted S3 file: ${fileUrl}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete S3 file: ${fileUrl}`, error);
    }
  }

  /**
   * Call RAG service to cleanup vector store and caches
   */
  private async cleanupRagData(ragFileId: string): Promise<void> {
    try {
      await this.ragService.cleanup(ragFileId);
      this.logger.log(`RAG cleanup completed for: ${ragFileId}`);
    } catch (error) {
      this.logger.error(`RAG cleanup failed for: ${ragFileId}`, error);
    }
  }
}
