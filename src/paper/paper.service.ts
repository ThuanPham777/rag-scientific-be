import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaperRequestDto } from './dto/create-paper-request.dto';
import { PaperItemDto } from './dto/create-paper-response.dto';

@Injectable()
export class PaperService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
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

      // Call RAG service - Use 127.0.0.1 instead of localhost to avoid IPv6 issues
      const ragUrl = process.env.RAG_SERVICE_URL ?? 'http://127.0.0.1:8000';
      const response = await this.http.axiosRef.post(
        `${ragUrl}/ingest-from-url`,
        {
          file_url: fileUrl,
          file_id: ragFileId,
        },
      );

      // Update paper with metadata from RAG
      await this.prisma.paper.update({
        where: { id: paperId },
        data: {
          status: 'COMPLETED',
          title: response.data.title,
          abstract: response.data.abstract,
          nodeCount: response.data.node_count,
          tableCount: response.data.table_count,
          imageCount: response.data.image_count,
          processedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('RAG ingestion failed:', error);
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
   * Delete a paper
   */
  async deletePaper(userId: string, id: string): Promise<void> {
    const paper = await this.prisma.paper.findFirst({
      where: { id, userId },
    });

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    await this.prisma.paper.delete({ where: { id } });
  }
}
