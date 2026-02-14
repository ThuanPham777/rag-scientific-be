// src/highlight/highlight.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { SessionGateway } from '../session/session.gateway';
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

  constructor(
    private prisma: PrismaService,
    private sessionService: SessionService,
    private sessionGateway: SessionGateway,
  ) {}

  /**
   * Check if user has access to a paper — either as owner or as a collaborative session member.
   */
  private async verifyPaperAccess(
    userId: string,
    paperId: string,
  ): Promise<{
    paper: { id: string; userId: string };
    conversationId?: string;
  }> {
    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
      select: { id: true, userId: true },
    });

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    // Owner always has access
    if (paper.userId === userId) {
      return { paper };
    }

    // Check if user is a member of any collaborative session for this paper
    const collaborativeConv = await this.prisma.conversation.findFirst({
      where: {
        paperId,
        isCollaborative: true,
        sessionMembers: {
          some: { userId, isActive: true },
        },
      },
      select: { id: true },
    });

    if (collaborativeConv) {
      return { paper, conversationId: collaborativeConv.id };
    }

    throw new ForbiddenException('You do not have access to this paper');
  }

  /**
   * Create a new highlight for a paper.
   * Accessible by paper owner or collaborative session members.
   */
  async create(
    userId: string,
    paperId: string,
    dto: CreateHighlightDto,
  ): Promise<HighlightItemDto> {
    const { conversationId } = await this.verifyPaperAccess(userId, paperId);

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
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        _count: {
          select: { comments: true },
        },
      },
    });

    this.logger.log(
      `Created highlight ${highlight.id} for paper ${paperId} by user ${userId}`,
    );

    // Broadcast to collaborative session if applicable
    if (conversationId) {
      this.sessionGateway.broadcastHighlightEvent(
        conversationId,
        'added',
        highlight,
      );
    }

    return highlight as unknown as HighlightItemDto;
  }

  /**
   * Get all highlights for a paper.
   * In collaborative sessions, returns ALL highlights from all members.
   */
  async findByPaper(
    userId: string,
    paperId: string,
    pageNumber?: number,
  ): Promise<HighlightItemDto[]> {
    await this.verifyPaperAccess(userId, paperId);

    const whereClause: any = { paperId };
    if (pageNumber !== undefined) {
      whereClause.pageNumber = pageNumber;
    }

    const highlights = await this.prisma.highlight.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        _count: {
          select: { comments: true },
        },
      },
      orderBy: [{ pageNumber: 'asc' }, { createdAt: 'asc' }],
    });

    return highlights as unknown as HighlightItemDto[];
  }

  /**
   * Get a single highlight with its comments.
   * In collaborative sessions, any member can view any highlight.
   */
  async findOne(
    userId: string,
    highlightId: string,
  ): Promise<HighlightWithCommentsDto> {
    const highlight = await this.prisma.highlight.findUnique({
      where: { id: highlightId },
      include: {
        comments: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        _count: {
          select: { comments: true },
        },
      },
    });

    if (!highlight) {
      throw new NotFoundException('Highlight not found');
    }

    // Check access via paper
    await this.verifyPaperAccess(userId, highlight.paperId);

    return highlight as unknown as HighlightWithCommentsDto;
  }

  /**
   * Update a highlight (only color can be changed).
   * Only the highlight creator can update it.
   */
  async update(
    userId: string,
    highlightId: string,
    dto: UpdateHighlightDto,
  ): Promise<HighlightItemDto> {
    const existing = await this.prisma.highlight.findUnique({
      where: { id: highlightId },
      select: { id: true, userId: true, paperId: true },
    });

    if (!existing) {
      throw new NotFoundException('Highlight not found');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException(
        'Only the creator can update this highlight',
      );
    }

    const highlight = await this.prisma.highlight.update({
      where: { id: highlightId },
      data: {
        color: dto.color,
      },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        _count: {
          select: { comments: true },
        },
      },
    });

    this.logger.log(`Updated highlight ${highlightId} by user ${userId}`);

    // Broadcast to collaborative session if applicable
    const collaborativeConv = await this.prisma.conversation.findFirst({
      where: {
        paperId: existing.paperId,
        isCollaborative: true,
      },
      select: { id: true },
    });
    if (collaborativeConv) {
      this.sessionGateway.broadcastHighlightEvent(
        collaborativeConv.id,
        'updated',
        highlight,
      );
    }

    return highlight as unknown as HighlightItemDto;
  }

  /**
   * Delete a highlight and all its comments.
   * Only the highlight creator or session owner can delete.
   */
  async delete(
    userId: string,
    highlightId: string,
  ): Promise<DeleteHighlightResultDto> {
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

    // Allow deletion by creator OR session owner
    if (existing.userId !== userId) {
      // Check if user is the session owner for this paper
      const collaborativeConv = await this.prisma.conversation.findFirst({
        where: {
          paperId: existing.paperId,
          isCollaborative: true,
          sessionMembers: {
            some: { userId, role: 'OWNER', isActive: true },
          },
        },
      });

      if (!collaborativeConv) {
        throw new ForbiddenException(
          'You do not have access to this highlight',
        );
      }
    }

    const commentCount = existing._count.comments;

    await this.prisma.highlight.delete({
      where: { id: highlightId },
    });

    this.logger.log(
      `Deleted highlight ${highlightId} with ${commentCount} comments by user ${userId}`,
    );

    // Broadcast to collaborative session if applicable
    const collaborativeConv = await this.prisma.conversation.findFirst({
      where: {
        paperId: existing.paperId,
        isCollaborative: true,
      },
      select: { id: true },
    });
    if (collaborativeConv) {
      this.sessionGateway.broadcastHighlightEvent(
        collaborativeConv.id,
        'deleted',
        { id: highlightId },
      );
    }

    return {
      message: 'Highlight deleted successfully',
      deletedComments: commentCount,
    };
  }
}
