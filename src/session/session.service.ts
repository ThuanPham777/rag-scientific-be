// src/session/session.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RagService } from '../rag/index';
import { SessionRole, MessageRole } from '../../generated/prisma/client';
import {
  CreateSessionDto,
  CreateSessionResultDto,
} from './dto/create-session.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { JoinSessionResultDto, SessionMemberDto } from './dto/join-session.dto';
import {
  SessionDetailDto,
  CreateInviteResultDto,
  RemoveMemberResultDto,
} from './dto/session-response.dto';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ragService: RagService,
  ) {}

  // =========================================================================
  // SESSION LIFECYCLE
  // =========================================================================

  /**
   * Start a collaborative (GROUP) session for a paper.
   * Clones the paper (new Paper row with a new ragFileId, same fileUrl),
   * clones all highlights and comments from the original paper,
   * creates a GROUP conversation referencing the cloned paper,
   * triggers RAG ingestion for the clone, and generates an invite link.
   */
  async createSession(
    userId: string,
    dto: CreateSessionDto,
  ): Promise<CreateSessionResultDto> {
    // 1. Verify the paper exists and belongs to the user
    const paper = await this.prisma.paper.findFirst({
      where: { id: dto.paperId, userId },
    });

    if (!paper) {
      throw new ForbiddenException('Paper not found or not owned by user');
    }

    // 2. Generate unique IDs
    const sessionCode = this.generateSessionCode();
    const inviteToken = this.generateInviteToken();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
    const clonedRagFileId = crypto.randomUUID();
    const conversationTitle = `[Group] ${paper.title || paper.fileName}`;

    // 3. Transaction: clone paper + create GROUP conversation + owner membership + invite
    const result = await this.prisma.$transaction(async (tx) => {
      // Clone the paper (same fileUrl, new ragFileId)
      // IMPORTANT: folderId must be null — group papers are tied to
      // conversations, NOT folders. Folders are a private UI layer.
      const clonedPaper = await tx.paper.create({
        data: {
          userId,
          folderId: null, // Group paper must NOT belong to any folder
          fileName: paper.fileName,
          fileUrl: paper.fileUrl,
          fileSize: paper.fileSize,
          fileHash: paper.fileHash,
          ragFileId: clonedRagFileId,
          title: paper.title,
          abstract: paper.abstract,
          authors: paper.authors,
          summary: paper.summary,
          numPages: paper.numPages,
          status: 'PENDING', // Will be processed by RAG
        },
      });

      // Create GROUP conversation
      const conversation = await tx.conversation.create({
        data: {
          userId,
          paperId: clonedPaper.id,
          title: conversationTitle,
          type: 'GROUP',
          isCollaborative: true,
          sessionCode,
          maxMembers: dto.maxMembers || 10,
          sessionMembers: {
            create: {
              userId,
              role: SessionRole.OWNER,
            },
          },
          sessionInvites: {
            create: {
              invitedBy: userId,
              inviteToken,
              expiresAt,
              maxUses: 0, // unlimited
            },
          },
        },
      });

      // Clone messages from source conversation (if provided)
      if (dto.sourceConversationId) {
        const sourceMessages = await tx.message.findMany({
          where: { conversationId: dto.sourceConversationId },
          orderBy: { createdAt: 'asc' },
        });

        if (sourceMessages.length > 0) {
          await tx.message.createMany({
            data: sourceMessages.map((msg) => ({
              conversationId: conversation.id,
              userId: msg.userId,
              role: msg.role,
              content: msg.content,
              imageUrl: msg.imageUrl,
              modelName: msg.modelName,
              tokenCount: msg.tokenCount,
              context: msg.context ?? undefined,
              createdAt: msg.createdAt,
            })),
          });
        }
      }

      // Clone highlights and comments from source paper
      const sourceHighlights = await tx.highlight.findMany({
        where: { paperId: dto.paperId },
        include: {
          comments: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Create mapping from old highlight IDs to new highlight IDs
      for (const sourceHighlight of sourceHighlights) {
        const newHighlight = await tx.highlight.create({
          data: {
            paperId: clonedPaper.id,
            userId: sourceHighlight.userId,
            pageNumber: sourceHighlight.pageNumber,
            selectionRects: sourceHighlight.selectionRects,
            selectedText: sourceHighlight.selectedText,
            textPrefix: sourceHighlight.textPrefix,
            textSuffix: sourceHighlight.textSuffix,
            color: sourceHighlight.color,
            createdAt: sourceHighlight.createdAt,
          },
        });

        // Clone comments for this highlight
        if (sourceHighlight.comments.length > 0) {
          await tx.highlightComment.createMany({
            data: sourceHighlight.comments.map((comment) => ({
              highlightId: newHighlight.id,
              userId: comment.userId,
              content: comment.content,
              createdAt: comment.createdAt,
            })),
          });
        }
      }

      return { clonedPaper, conversation };
    });

    // 4. Trigger RAG ingestion for the cloned paper (async, don't block)
    this.triggerRagIngestion(
      result.clonedPaper.id,
      clonedRagFileId,
      paper.fileUrl,
    ).catch((err) => this.logger.error('Unexpected RAG ingestion error', err));

    this.logger.log(
      `Group session created: conversation ${result.conversation.id}, cloned paper ${result.clonedPaper.id} from ${dto.paperId}`,
    );

    const frontendUrl = this.config.get(
      'FRONTEND_URL',
      'http://localhost:5173',
    );

    return {
      conversationId: result.conversation.id,
      paperId: result.clonedPaper.id,
      sessionCode,
      inviteLink: `${frontendUrl}/session/join/${inviteToken}`,
      inviteToken,
      expiresAt,
      maxMembers: dto.maxMembers || 10,
    };
  }

  /**
   * Trigger RAG ingestion for a cloned paper (background).
   */
  private async triggerRagIngestion(
    paperId: string,
    ragFileId: string,
    fileUrl: string,
  ) {
    try {
      await this.prisma.paper.update({
        where: { id: paperId },
        data: { status: 'PROCESSING' },
      });

      const response = await this.ragService.ingestFromUrl(fileUrl, ragFileId);

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
      this.logger.error(
        `RAG ingestion failed for cloned paper ${paperId}:`,
        error,
      );
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
   * Join a collaborative session via invite token.
   */
  async joinSession(
    userId: string,
    inviteToken: string,
  ): Promise<JoinSessionResultDto> {
    // 1. Find and validate invite (read outside transaction — immutable data)
    const invite = await this.prisma.sessionInvite.findUnique({
      where: { inviteToken },
      include: {
        conversation: {
          include: {
            paper: {
              select: {
                id: true,
                title: true,
                fileUrl: true,
                fileName: true,
                ragFileId: true,
              },
            },
          },
        },
      },
    });

    if (!invite) {
      throw new NotFoundException('Invalid invite link');
    }

    if (invite.isRevoked) {
      throw new BadRequestException('This invite has been revoked');
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('This invite has expired');
    }

    if (invite.maxUses > 0 && invite.useCount >= invite.maxUses) {
      throw new BadRequestException('This invite has reached its maximum uses');
    }

    if (!invite.conversation.isCollaborative) {
      throw new BadRequestException('This conversation is not collaborative');
    }

    // 2. Transaction: membership check/create + use-count increment
    //    Prevents race conditions on member limit, use count, and
    //    duplicate inserts (e.g. React StrictMode double-firing).
    let memberRole: string = 'MEMBER';

    await this.prisma.$transaction(async (tx) => {
      // 2a. Check existing membership
      const existingMember = await tx.sessionMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId: invite.conversationId,
            userId,
          },
        },
      });

      if (existingMember) {
        if (existingMember.isActive) {
          // Already an active member — idempotent success (handles double-fire)
          memberRole = existingMember.role;
          return;
        }
        // Re-activate if previously left
        await tx.sessionMember.update({
          where: { id: existingMember.id },
          data: { isActive: true, leftAt: null },
        });
        memberRole = existingMember.role;
      } else {
        // 2b. Check member limit
        const memberCount = await tx.sessionMember.count({
          where: {
            conversationId: invite.conversationId,
            isActive: true,
          },
        });

        if (memberCount >= invite.conversation.maxMembers) {
          throw new BadRequestException(
            'This session has reached its member limit',
          );
        }

        // 2c. Create membership
        try {
          await tx.sessionMember.create({
            data: {
              conversationId: invite.conversationId,
              userId,
              role: SessionRole.MEMBER,
            },
          });
        } catch (error: any) {
          // Handle unique constraint race (concurrent duplicate request)
          if (error?.code === 'P2002') {
            this.logger.warn(
              `Duplicate join request for user ${userId} in session ${invite.conversationId}`,
            );
            return;
          }
          throw error;
        }
      }

      // 2d. Increment invite use count (inside transaction)
      await tx.sessionInvite.update({
        where: { id: invite.id },
        data: { useCount: { increment: 1 } },
      });
    });

    // 3. Fetch members (outside transaction — read-only)
    const members = await this.getSessionMembers(invite.conversationId);

    this.logger.log(`User ${userId} joined session ${invite.conversationId}`);

    return {
      conversationId: invite.conversationId,
      sessionCode: invite.conversation.sessionCode!,
      role: memberRole,
      paperId: invite.conversation.paper?.id || '',
      paperTitle: invite.conversation.paper?.title || '',
      paperFileName: invite.conversation.paper?.fileName || '',
      paperUrl: invite.conversation.paper?.fileUrl || '',
      paperRagFileId: invite.conversation.paper?.ragFileId || '',
      members,
    };
  }

  /**
   * Leave a collaborative session.
   * Any member, including OWNER, can leave. Session continues for remaining members.
   */
  async leaveSession(userId: string, conversationId: string): Promise<void> {
    const member = await this.prisma.sessionMember.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    });

    if (!member) {
      throw new NotFoundException('You are not a member of this session');
    }

    await this.prisma.sessionMember.update({
      where: { id: member.id },
      data: { isActive: false, leftAt: new Date() },
    });

    this.logger.log(`User ${userId} left session ${conversationId}`);
  }

  /**
   * End a collaborative session (owner only).
   * Deactivates all members and revokes all invites. Conversation data is preserved.
   */
  async endSession(userId: string, conversationId: string): Promise<void> {
    await this.verifyOwnership(userId, conversationId);

    await this.prisma.$transaction([
      // Deactivate all members
      this.prisma.sessionMember.updateMany({
        where: { conversationId },
        data: { isActive: false, leftAt: new Date() },
      }),
      // Revoke all invites
      this.prisma.sessionInvite.updateMany({
        where: { conversationId },
        data: { isRevoked: true },
      }),
      // Mark conversation as no longer collaborative
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { isCollaborative: false },
      }),
    ]);

    this.logger.log(`Session ended for conversation ${conversationId}`);
  }

  // =========================================================================
  // MEMBER MANAGEMENT
  // =========================================================================

  /**
   * Remove a member from the session (owner only).
   */
  async removeMember(
    userId: string,
    conversationId: string,
    targetUserId: string,
  ): Promise<RemoveMemberResultDto> {
    await this.verifyOwnership(userId, conversationId);

    if (userId === targetUserId) {
      throw new BadRequestException('Cannot remove yourself');
    }

    const member = await this.prisma.sessionMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: targetUserId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this session');
    }

    await this.prisma.sessionMember.update({
      where: { id: member.id },
      data: { isActive: false, leftAt: new Date() },
    });

    this.logger.log(
      `User ${targetUserId} removed from session ${conversationId} by ${userId}`,
    );

    return { removed: true, userId: targetUserId };
  }

  /**
   * Get all active members of a session.
   */
  async getSessionMembers(conversationId: string): Promise<SessionMemberDto[]> {
    const members = await this.prisma.sessionMember.findMany({
      where: { conversationId, isActive: true },
      include: {
        user: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return members.map((m) => ({
      userId: m.user.id,
      displayName: m.user.displayName || 'Anonymous',
      avatarUrl: m.user.avatarUrl || null,
      role: m.role,
      joinedAt: m.joinedAt,
      isActive: m.isActive,
    }));
  }

  // =========================================================================
  // INVITE MANAGEMENT
  // =========================================================================

  /**
   * Create a new invite link for a session.
   * Invite links do not expire.
   */
  async createInvite(
    userId: string,
    conversationId: string,
    dto: CreateInviteDto,
  ): Promise<CreateInviteResultDto> {
    await this.verifyMembership(userId, conversationId);

    const inviteToken = this.generateInviteToken();
    // Set expiration to 100 years in the future (effectively no expiration)
    const expiresAt = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);

    await this.prisma.sessionInvite.create({
      data: {
        conversationId,
        invitedBy: userId,
        inviteToken,
        expiresAt,
        maxUses: dto.maxUses || 0,
      },
    });

    const frontendUrl = this.config.get(
      'FRONTEND_URL',
      'http://localhost:5173',
    );

    return {
      inviteToken,
      inviteLink: `${frontendUrl}/session/join/${inviteToken}`,
      expiresAt,
      maxUses: dto.maxUses || 0,
    };
  }

  /**
   * Revoke an invite token (any member).
   */
  async revokeInvite(userId: string, inviteToken: string): Promise<void> {
    const invite = await this.prisma.sessionInvite.findUnique({
      where: { inviteToken },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    await this.verifyMembership(userId, invite.conversationId);

    await this.prisma.sessionInvite.update({
      where: { id: invite.id },
      data: { isRevoked: true },
    });
  }

  /**
   * Get the current active invite for a conversation.
   * Returns null if no active invite exists.
   */
  async getActiveInvite(
    userId: string,
    conversationId: string,
  ): Promise<CreateInviteResultDto | null> {
    await this.verifyMembership(userId, conversationId);

    const invite = await this.prisma.sessionInvite.findFirst({
      where: {
        conversationId,
        isRevoked: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!invite) {
      return null;
    }

    const frontendUrl = this.config.get(
      'FRONTEND_URL',
      'http://localhost:5173',
    );

    return {
      inviteToken: invite.inviteToken,
      inviteLink: `${frontendUrl}/session/join/${invite.inviteToken}`,
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses,
    };
  }

  /**
   * Reset invite: revoke all existing invites and create a new one.
   * Any member can do this. Invite links do not expire.
   */
  async resetInvite(
    userId: string,
    conversationId: string,
  ): Promise<CreateInviteResultDto> {
    await this.verifyMembership(userId, conversationId);

    // Revoke all existing invites for this conversation
    await this.prisma.sessionInvite.updateMany({
      where: { conversationId, isRevoked: false },
      data: { isRevoked: true },
    });

    // Create a new invite with no expiration
    const inviteToken = this.generateInviteToken();
    const expiresAt = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);

    await this.prisma.sessionInvite.create({
      data: {
        conversationId,
        invitedBy: userId,
        inviteToken,
        expiresAt,
        maxUses: 0, // unlimited
      },
    });

    const frontendUrl = this.config.get(
      'FRONTEND_URL',
      'http://localhost:5173',
    );

    return {
      inviteToken,
      inviteLink: `${frontendUrl}/session/join/${inviteToken}`,
      expiresAt,
      maxUses: 0,
    };
  }

  /**
   * Delete (revoke) all active invites for a conversation.
   * Any member can do this.
   */
  async deleteInvite(userId: string, conversationId: string): Promise<void> {
    await this.verifyMembership(userId, conversationId);

    await this.prisma.sessionInvite.updateMany({
      where: { conversationId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  // =========================================================================
  // SESSION QUERIES
  // =========================================================================

  /**
   * Get session detail by conversation ID.
   */
  async getSessionDetail(
    userId: string,
    conversationId: string,
  ): Promise<SessionDetailDto> {
    await this.verifyMembership(userId, conversationId);

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        paper: {
          select: { id: true, title: true, fileName: true, fileUrl: true },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const members = await this.getSessionMembers(conversationId);

    return {
      conversationId: conversation.id,
      sessionCode: conversation.sessionCode || '',
      isCollaborative: conversation.isCollaborative,
      maxMembers: conversation.maxMembers,
      memberCount: members.length,
      members,
      paperId: conversation.paper?.id,
      paperTitle: conversation.paper?.title || undefined,
      paperFileName: conversation.paper?.fileName || undefined,
      paperUrl: conversation.paper?.fileUrl || undefined,
      createdAt: conversation.createdAt,
    };
  }

  /**
   * List collaborative sessions the user is a member of.
   */
  async listUserSessions(userId: string): Promise<SessionDetailDto[]> {
    const memberships = await this.prisma.sessionMember.findMany({
      where: { userId, isActive: true },
      include: {
        conversation: {
          include: {
            paper: {
              select: { id: true, title: true, fileName: true, fileUrl: true },
            },
            _count: {
              select: { sessionMembers: { where: { isActive: true } } },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships
      .filter((m) => m.conversation.isCollaborative)
      .map((m) => ({
        conversationId: m.conversation.id,
        sessionCode: m.conversation.sessionCode || '',
        isCollaborative: m.conversation.isCollaborative,
        maxMembers: m.conversation.maxMembers,
        memberCount: m.conversation._count.sessionMembers,
        members: [], // Light response — use getSessionDetail for full list
        paperId: m.conversation.paper?.id,
        paperTitle: m.conversation.paper?.title || undefined,
        paperFileName: m.conversation.paper?.fileName || undefined,
        paperUrl: m.conversation.paper?.fileUrl || undefined,
        createdAt: m.conversation.createdAt,
      }));
  }

  // =========================================================================
  // ACCESS CONTROL HELPERS (exported for use by other services)
  // =========================================================================

  /**
   * Check if a user has membership in a collaborative conversation.
   * For non-collaborative conversations, checks ownership.
   * Returns the membership role if found.
   */
  async checkAccess(
    userId: string,
    conversationId: string,
  ): Promise<{ hasAccess: boolean; role: SessionRole | 'OWNER_LEGACY' }> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return { hasAccess: false, role: 'MEMBER' as SessionRole };
    }

    // Non-collaborative: only owner has access (backward compatible)
    if (!conversation.isCollaborative) {
      return {
        hasAccess: conversation.userId === userId,
        role: 'OWNER_LEGACY',
      };
    }

    // Collaborative: check session membership
    const member = await this.prisma.sessionMember.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    });

    if (!member || !member.isActive) {
      return { hasAccess: false, role: 'MEMBER' as SessionRole };
    }

    return { hasAccess: true, role: member.role };
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  private async verifyOwnership(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    const member = await this.prisma.sessionMember.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    });

    if (!member || member.role !== SessionRole.OWNER) {
      throw new ForbiddenException('Only the session owner can do this');
    }
  }

  private async verifyMembership(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    const { hasAccess } = await this.checkAccess(userId, conversationId);
    if (!hasAccess) {
      throw new ForbiddenException('You are not a member of this session');
    }
  }

  // =========================================================================
  // SYSTEM MESSAGES
  // =========================================================================

  /**
   * Create a SYSTEM message in the database.
   * Used for join / leave / end / remove events.
   */
  async createSystemMessage(
    conversationId: string,
    content: string,
  ): Promise<{ id: string; content: string; createdAt: Date }> {
    const msg = await this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.SYSTEM,
        content,
        userId: null,
      },
    });
    return { id: msg.id, content: msg.content, createdAt: msg.createdAt };
  }

  /**
   * Get a user's display name (used to build system message text).
   */
  async getUserDisplayName(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    return user?.displayName || 'A member';
  }

  private generateSessionCode(): string {
    return randomBytes(4).toString('hex').toUpperCase(); // 8-char hex
  }

  private generateInviteToken(): string {
    return randomBytes(32).toString('hex'); // 64-char hex
  }
}
