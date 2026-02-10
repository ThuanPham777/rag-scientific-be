// src/highlight/highlight.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHighlightDto } from './dto/create-highlight.dto';
import { UpdateHighlightDto } from './dto/update-highlight.dto';
import {
  HighlightItemDto,
  HighlightWithCommentsDto,
  DeleteHighlightResultDto,
} from './dto/highlight-response.dto';

@Injectable()
export class HighlightService {
  private readonly logger = new Logger(HighlightService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new highlight for a paper
   */
  async create(
    userId: string,
    paperId: string,
    dto: CreateHighlightDto,
  ): Promise<HighlightItemDto> {
    // Verify paper exists and user owns it
    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
      select: { id: true, userId: true },
    });

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    if (paper.userId !== userId) {
      throw new ForbiddenException('You do not have access to this paper');
    }

    const highlight = await this.prisma.highlight.create({
      data: {
        paperId,
        userId,
        pageNumber: dto.pageNumber,
        selectionRects: dto.selectionRects as unknown as Prisma.InputJsonValue,
        selectedText: dto.selectedText,
        textPrefix: dto.textPrefix,
        textSuffix: dto.textSuffix,
        color: dto.color || 'YELLOW',
      },
      include: {
        _count: {
          select: { comments: true },
        },
      },
    });

    this.logger.log(
      `Created highlight ${highlight.id} for paper ${paperId} by user ${userId}`,
    );

    return highlight as unknown as HighlightItemDto;
  }

  /**
   * Get all highlights for a paper
   * Optionally filter by page number
   */
  async findByPaper(
    userId: string,
    paperId: string,
    pageNumber?: number,
  ): Promise<HighlightItemDto[]> {
    // Verify paper exists and user owns it
    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
      select: { id: true, userId: true },
    });

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    if (paper.userId !== userId) {
      throw new ForbiddenException('You do not have access to this paper');
    }

    const whereClause: any = { paperId };
    if (pageNumber !== undefined) {
      whereClause.pageNumber = pageNumber;
    }

    const highlights = await this.prisma.highlight.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { comments: true },
        },
      },
      orderBy: [{ pageNumber: 'asc' }, { createdAt: 'asc' }],
    });

    return highlights as unknown as HighlightItemDto[];
  }

  /**
   * Get a single highlight with its comments
   */
  async findOne(
    userId: string,
    highlightId: string,
  ): Promise<HighlightWithCommentsDto> {
    const highlight = await this.prisma.highlight.findUnique({
      where: { id: highlightId },
      include: {
        comments: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { comments: true },
        },
      },
    });

    if (!highlight) {
      throw new NotFoundException('Highlight not found');
    }

    if (highlight.userId !== userId) {
      throw new ForbiddenException('You do not have access to this highlight');
    }

    return highlight as unknown as HighlightWithCommentsDto;
  }

  /**
   * Update a highlight (only color can be changed)
   */
  async update(
    userId: string,
    highlightId: string,
    dto: UpdateHighlightDto,
  ): Promise<HighlightItemDto> {
    // Verify highlight exists and user owns it
    const existing = await this.prisma.highlight.findUnique({
      where: { id: highlightId },
      select: { id: true, userId: true },
    });

    if (!existing) {
      throw new NotFoundException('Highlight not found');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('You do not have access to this highlight');
    }

    const highlight = await this.prisma.highlight.update({
      where: { id: highlightId },
      data: {
        color: dto.color,
      },
      include: {
        _count: {
          select: { comments: true },
        },
      },
    });

    this.logger.log(`Updated highlight ${highlightId} by user ${userId}`);

    return highlight as unknown as HighlightItemDto;
  }

  /**
   * Delete a highlight and all its comments
   */
  async delete(
    userId: string,
    highlightId: string,
  ): Promise<DeleteHighlightResultDto> {
    // Verify highlight exists and user owns it
    const existing = await this.prisma.highlight.findUnique({
      where: { id: highlightId },
      include: {
        _count: {
          select: { comments: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Highlight not found');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('You do not have access to this highlight');
    }

    const commentCount = existing._count.comments;

    await this.prisma.highlight.delete({
      where: { id: highlightId },
    });

    this.logger.log(
      `Deleted highlight ${highlightId} with ${commentCount} comments by user ${userId}`,
    );

    return {
      message: 'Highlight deleted successfully',
      deletedComments: commentCount,
    };
  }
}
