// src/highlight/comment.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCommentDto,
  UpdateCommentDto,
  CommentItemDto,
  DeleteCommentResultDto,
} from './dto/comment.dto';

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a comment on a highlight
   */
  async create(
    userId: string,
    highlightId: string,
    dto: CreateCommentDto,
  ): Promise<CommentItemDto> {
    // Verify highlight exists and user owns it
    const highlight = await this.prisma.highlight.findUnique({
      where: { id: highlightId },
      select: { id: true, userId: true },
    });

    if (!highlight) {
      throw new NotFoundException('Highlight not found');
    }

    if (highlight.userId !== userId) {
      throw new ForbiddenException('You do not have access to this highlight');
    }

    const comment = await this.prisma.highlightComment.create({
      data: {
        highlightId,
        userId,
        content: dto.content,
      },
    });

    this.logger.log(
      `Created comment ${comment.id} on highlight ${highlightId} by user ${userId}`,
    );

    return comment as CommentItemDto;
  }

  /**
   * Get all comments for a highlight
   */
  async findByHighlight(
    userId: string,
    highlightId: string,
  ): Promise<CommentItemDto[]> {
    // Verify highlight exists and user owns it
    const highlight = await this.prisma.highlight.findUnique({
      where: { id: highlightId },
      select: { id: true, userId: true },
    });

    if (!highlight) {
      throw new NotFoundException('Highlight not found');
    }

    if (highlight.userId !== userId) {
      throw new ForbiddenException('You do not have access to this highlight');
    }

    const comments = await this.prisma.highlightComment.findMany({
      where: { highlightId },
      orderBy: { createdAt: 'asc' },
    });

    return comments as CommentItemDto[];
  }

  /**
   * Update a comment
   */
  async update(
    userId: string,
    commentId: string,
    dto: UpdateCommentDto,
  ): Promise<CommentItemDto> {
    // Verify comment exists and user owns it
    const existing = await this.prisma.highlightComment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true },
    });

    if (!existing) {
      throw new NotFoundException('Comment not found');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('You do not have access to this comment');
    }

    const comment = await this.prisma.highlightComment.update({
      where: { id: commentId },
      data: {
        content: dto.content,
      },
    });

    this.logger.log(`Updated comment ${commentId} by user ${userId}`);

    return comment as CommentItemDto;
  }

  /**
   * Delete a comment
   */
  async delete(
    userId: string,
    commentId: string,
  ): Promise<DeleteCommentResultDto> {
    // Verify comment exists and user owns it
    const existing = await this.prisma.highlightComment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true },
    });

    if (!existing) {
      throw new NotFoundException('Comment not found');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('You do not have access to this comment');
    }

    await this.prisma.highlightComment.delete({
      where: { id: commentId },
    });

    this.logger.log(`Deleted comment ${commentId} by user ${userId}`);

    return {
      message: 'Comment deleted successfully',
    };
  }
}
