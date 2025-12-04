import { Injectable } from '@nestjs/common';
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
  constructor(private readonly prisma: PrismaService) {}

  private mapToPaperItem(p: any): PaperItemDto {
    const dto = new PaperItemDto();
    dto.id = p.id;
    dto.title = p.title ?? null;
    dto.url = p.url ?? null;
    dto.status = p.status ?? null;
    dto.createdAt = p.createdAt;
    return dto;
  }

  async createPaper(
    userId: string,
    dto: CreatePaperRequestDto,
  ): Promise<CreatePaperResponseDto> {
    const paper = await this.prisma.paper.create({
      data: {
        owner_user_id: userId,
        title: dto.title,
        file_path: dto.filePath,
        url: dto.fileUrl,
        source: 'upload',
        status: 'processing',
      },
    });

    const response = new CreatePaperResponseDto();
    response.success = true;
    response.message = 'Paper created';
    response.data = this.mapToPaperItem(paper);
    return response;
  }

  async listMyPapers(userId: string): Promise<ListPapersResponseDto> {
    const papers = await this.prisma.paper.findMany({
      where: { owner_user_id: userId },
      orderBy: { created_at: 'desc' },
    });

    const response = new ListPapersResponseDto();
    response.success = true;
    response.message = 'List of papers';
    response.data = papers.map((p) => this.mapToPaperItem(p));
    return response;
  }

  async getPaperById(userId: string, id: string): Promise<GetPaperResponseDto> {
    const paper = await this.prisma.paper.findFirst({
      where: { id, owner_user_id: userId },
    });

    const response = new GetPaperResponseDto();
    response.success = true;
    response.message = 'Paper detail';
    response.data = this.mapToPaperItem(paper);
    return response;
  }
}
