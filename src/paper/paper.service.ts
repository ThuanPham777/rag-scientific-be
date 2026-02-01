import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaperRequestDto } from './dto/create-paper-request.dto';
import {
  CreatePaperResponseDto,
  PaperItemDto,
} from './dto/create-paper-response.dto';
import { ListPapersResponseDto } from './dto/list-papers-response.dto';
import { GetPaperResponseDto } from './dto/get-paper-response.dto';

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

  async createPaper(
    userId: string,
    dto: CreatePaperRequestDto,
  ): Promise<CreatePaperResponseDto> {
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
      },
    });

    // Call RAG service to ingest the PDF
    this.triggerRagIngestion(paper.id, ragFileId, dto.fileUrl);

    const response = new CreatePaperResponseDto();
    response.success = true;
    response.message = 'Paper created and processing started';
    response.data = this.mapToPaperItem(paper);
    return response;
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

  async listMyPapers(userId: string): Promise<ListPapersResponseDto> {
    const papers = await this.prisma.paper.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const response = new ListPapersResponseDto();
    response.success = true;
    response.message = 'List of papers';
    response.data = papers.map((p) => this.mapToPaperItem(p));
    return response;
  }

  async getPaperById(userId: string, id: string): Promise<GetPaperResponseDto> {
    const paper = await this.prisma.paper.findFirst({
      where: { id, userId },
    });

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    const response = new GetPaperResponseDto();
    response.success = true;
    response.message = 'Paper detail';
    response.data = this.mapToPaperItem(paper);
    return response;
  }

  async getPaperByRagFileId(
    userId: string,
    ragFileId: string,
  ): Promise<GetPaperResponseDto> {
    const paper = await this.prisma.paper.findFirst({
      where: { ragFileId, userId },
    });

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    const response = new GetPaperResponseDto();
    response.success = true;
    response.message = 'Paper detail';
    response.data = this.mapToPaperItem(paper);
    return response;
  }

  async deletePaper(userId: string, id: string): Promise<{ success: boolean }> {
    const paper = await this.prisma.paper.findFirst({
      where: { id, userId },
    });

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    await this.prisma.paper.delete({ where: { id } });

    return { success: true };
  }
}
