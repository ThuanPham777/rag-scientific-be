// src/highlight/comment.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionGateway } from '../session/session.gateway';
import {
  CreateCommentDto,
  UpdateCommentDto,
  CommentItemDto,
  DeleteCommentResultDto,
} from './dto/comment.dto';

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    private prisma: PrismaService,
    private sessionGateway: SessionGateway,
  ) {}

  // =========================================================================
  // ACCESS HELPERS
  // =========================================================================

  /**
   * Verify user has access to a highlight (owner of paper OR session member).
   * Returns the highlight and the collaborative conversationId if applicable.
   */
  private async verifyHighlightAccess(
    userId: string,
    highlightId: string,
  ): Promise<{
    highlight: { id: string; userId: string; paperId: string };
    conversationId?: string;
  }> {
    const highlight = await this.prisma.highlight.findUnique({
      where: { id: highlightId },
      select: { id: true, userId: true, paperId: true },
    });

    if (!highlight) {
      throw new NotFoundException('Highlight not found');
    }

    // Paper owner check
    const paper = await this.prisma.paper.findUnique({
      where: { id: highlight.paperId },
      select: { userId: true },
    });

    const isOwner = paper?.userId === userId;
    const isCreator = highlight.userId === userId;

    // Look for collaborative conversation — needed for socket broadcasts
    // regardless of whether user is owner/creator.
    const collaborativeConv = await this.prisma.conversation.findFirst({
      where: {
        paperId: highlight.paperId,
        isCollaborative: true,
      },
      select: { id: true },
    });

    // Paper owner or highlight creator always has access
    if (isOwner || isCreator) {
      return { highlight, conversationId: collaborativeConv?.id };
    }

    // Non-owner/non-creator: must be an active session member
    if (collaborativeConv) {
      const isMember = await this.prisma.sessionMember.findFirst({
        where: {
          conversationId: collaborativeConv.id,
          userId,
          isActive: true,
        },
      });
      if (isMember) {
        return { highlight, conversationId: collaborativeConv.id };
      }
    }

    throw new ForbiddenException('You do not have access to this highlight');
  }

  // =========================================================================
  // CRUD
  // =========================================================================

  /**
   * Create a comment on a highlight.
   * Accessible by paper owner, highlight creator, or collaborative session members.
   */
  async create(
    userId: string,
    highlightId: string,
    dto: CreateCommentDto,
  ): Promise<CommentItemDto> {
    const { conversationId } = await this.verifyHighlightAccess(
      userId,
      highlightId,
    );

    const comment = await this.prisma.highlightComment.create({
      data: {
        highlightId,
        userId,
        content: dto.content,
      },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    this.logger.log(
      `Created comment ${comment.id} on highlight ${highlightId} by user ${userId}`,
    );

    // Broadcast to collaborative session if applicable
    if (conversationId) {
      this.sessionGateway.broadcastCommentEvent(
        conversationId,
        'added',
        comment,
      );
    }

    return comment as unknown as CommentItemDto;
  }

  /**
   * Get all comments for a highlight.
   * Accessible by paper owner, highlight creator, or collaborative session members.
   */
  async findByHighlight(
    userId: string,
    highlightId: string,
  ): Promise<CommentItemDto[]> {
    await this.verifyHighlightAccess(userId, highlightId);

    const comments = await this.prisma.highlightComment.findMany({
      where: { highlightId },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return comments as unknown as CommentItemDto[];
  }

  /**
   * Update a comment.
   * Only the comment creator can update it.
   */
  async update(
    userId: string,
    commentId: string,
    dto: UpdateCommentDto,
  ): Promise<CommentItemDto> {
    const existing = await this.prisma.highlightComment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, highlightId: true },
    });

    if (!existing) {
      throw new NotFoundException('Comment not found');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('Only the comment creator can update it');
    }

    const comment = await this.prisma.highlightComment.update({
      where: { id: commentId },
      data: {
        content: dto.content,
      },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    this.logger.log(`Updated comment ${commentId} by user ${userId}`);

    // Broadcast to collaborative session if applicable
    const highlight = await this.prisma.highlight.findUnique({
      where: { id: existing.highlightId },
      select: { paperId: true },
    });
    if (highlight) {
      const collaborativeConv = await this.prisma.conversation.findFirst({
        where: {
          paperId: highlight.paperId,
          isCollaborative: true,
        },
        select: { id: true },
      });
      if (collaborativeConv) {
        this.sessionGateway.broadcastCommentEvent(
          collaborativeConv.id,
          'updated',
          comment,
        );
      }
    }

    return comment as unknown as CommentItemDto;
  }

  /**
   * Delete a comment.
   * Only the comment creator (or session owner) can delete it.
   */
  async delete(
    userId: string,
    commentId: string,
  ): Promise<DeleteCommentResultDto> {
    const existing = await this.prisma.highlightComment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, highlightId: true },
    });

    if (!existing) {
      throw new NotFoundException('Comment not found');
    }

    // Allow deletion by comment creator
    if (existing.userId !== userId) {
      // Also allow session owner to delete any comment
      const highlight = await this.prisma.highlight.findUnique({
        where: { id: existing.highlightId },
        select: { paperId: true },
      });

      if (highlight) {
        const sessionOwnerConv = await this.prisma.conversation.findFirst({
          where: {
            paperId: highlight.paperId,
            isCollaborative: true,
            sessionMembers: {
              some: { userId, role: 'OWNER', isActive: true },
            },
          },
        });

        if (!sessionOwnerConv) {
          throw new ForbiddenException(
            'Only the comment creator or session owner can delete this comment',
          );
        }
      } else {
        throw new ForbiddenException('You do not have access to this comment');
      }
    }

    await this.prisma.highlightComment.delete({
      where: { id: commentId },
    });

    this.logger.log(`Deleted comment ${commentId} by user ${userId}`);

    // Broadcast to collaborative session if applicable
    const highlightForBroadcast = await this.prisma.highlight.findUnique({
      where: { id: existing.highlightId },
      select: { paperId: true },
    });
    if (highlightForBroadcast) {
      const collaborativeConv = await this.prisma.conversation.findFirst({
        where: {
          paperId: highlightForBroadcast.paperId,
          isCollaborative: true,
        },
        select: { id: true },
      });
      if (collaborativeConv) {
        this.sessionGateway.broadcastCommentEvent(
          collaborativeConv.id,
          'deleted',
          { id: commentId, highlightId: existing.highlightId },
        );
      }
    }

    return {
      message: 'Comment deleted successfully',
    };
  }
}
