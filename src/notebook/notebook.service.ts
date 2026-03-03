import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotebookDto } from './dto/create-notebook.dto';
import { UpdateNotebookDto } from './dto/update-notebook.dto';
import { NotebookItemDto, NotebookDetailDto } from './dto/notebook-response.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class NotebookService {
  private readonly logger = new Logger(NotebookService.name);

  constructor(private prisma: PrismaService) { }

  /**
   * Get all notebooks owned by a user (list view - no full content)
   */
  async findAllByUser(userId: string): Promise<NotebookItemDto[]> {
    const notebooks = await this.prisma.notebook.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        userId: true,
        title: true,
        content: true,
        orderIndex: true,
        isCollaborative: true,
        shareToken: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return notebooks.map((nb) => ({
      ...nb,
      contentPreview: nb.content
        ? nb.content.replace(/<[^>]*>/g, '').substring(0, 200)
        : '',
    }));
  }

  /**
   * Get notebooks shared with the user (they are a collaborator but NOT the owner),
   * excluding ones they have soft-hidden.
   */
  async getSharedWithMe(userId: string): Promise<any[]> {
    const collaborations = await this.prisma.notebookCollaborator.findMany({
      where: {
        userId,
        isHidden: false,
        notebook: {
          userId: { not: userId }, // exclude notebooks owned by this user
        },
      },
      include: {
        notebook: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: [{ notebook: { createdAt: 'desc' } }, { notebook: { id: 'desc' } }],
    });

    return collaborations.map((c) => ({
      id: c.notebook.id,
      userId: c.notebook.userId,
      title: c.notebook.title,
      contentPreview: c.notebook.content
        ? c.notebook.content.replace(/<[^>]*>/g, '').substring(0, 200)
        : '',
      orderIndex: c.notebook.orderIndex,
      isCollaborative: c.notebook.isCollaborative,
      shareToken: c.notebook.shareToken,
      createdAt: c.notebook.createdAt,
      updatedAt: c.notebook.updatedAt,
      ownerName: c.notebook.user?.displayName ?? 'Unknown',
      ownerAvatarUrl: c.notebook.user?.avatarUrl ?? null,
      isSharedWithMe: true,
    }));
  }

  /**
   * Soft-hide a shared notebook from the "Shared with me" list.
   * Only works for collaborators (not owners).
   */
  async hideSharedNotebook(
    notebookId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const notebook = await this.prisma.notebook.findUnique({
      where: { id: notebookId },
    });

    if (!notebook) throw new NotFoundException('Notebook not found');
    if (notebook.userId === userId)
      throw new ForbiddenException('Owner cannot use hide; use delete instead');

    const collab = await this.prisma.notebookCollaborator.findUnique({
      where: { notebookId_userId: { notebookId, userId } },
    });

    if (!collab)
      throw new ForbiddenException('You are not a collaborator of this notebook');

    await this.prisma.notebookCollaborator.update({
      where: { notebookId_userId: { notebookId, userId } },
      data: { isHidden: true },
    });

    return { message: 'Notebook hidden from your shared list' };
  }

  /**
   * Get a single notebook with full content
   */
  async findOne(id: string, userId: string): Promise<NotebookDetailDto> {
    const notebook = await this.prisma.notebook.findUnique({
      where: { id },
    });

    if (!notebook) throw new NotFoundException('Notebook not found');
    if (notebook.userId !== userId)
      throw new ForbiddenException('You do not have access to this notebook');

    return notebook as NotebookDetailDto;
  }

  /**
   * Create a new notebook
   */
  async create(
    userId: string,
    dto: CreateNotebookDto,
  ): Promise<NotebookDetailDto> {
    const maxOrder = await this.prisma.notebook.aggregate({
      where: { userId },
      _max: { orderIndex: true },
    });

    const notebook = await this.prisma.notebook.create({
      data: {
        userId,
        title: dto.title || 'Untitled',
        content: dto.content || '',
        orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
      },
    });

    return notebook as NotebookDetailDto;
  }

  /**
   * Update notebook (title and/or content) - used for auto-save
   */
  async update(
    id: string,
    userId: string,
    dto: UpdateNotebookDto,
  ): Promise<NotebookDetailDto> {
    const notebook = await this.prisma.notebook.findUnique({ where: { id } });
    if (!notebook) throw new NotFoundException('Notebook not found');
    if (notebook.userId !== userId)
      throw new ForbiddenException('You do not have access to this notebook');

    const updated = await this.prisma.notebook.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
      },
    });

    return updated as NotebookDetailDto;
  }

  /**
   * Delete a notebook.
   * - Owner: truly deletes the notebook (cascade removes all collaborators).
   * - Collaborator (not owner): soft-hides it from their "Shared with me" list.
   */
  async remove(
    id: string,
    userId: string,
  ): Promise<{ message: string }> {
    const notebook = await this.prisma.notebook.findUnique({
      where: { id },
      include: { collaborators: true },
    });

    if (!notebook) throw new NotFoundException('Notebook not found');

    const isOwner = notebook.userId === userId;

    if (isOwner) {
      // Owner deletes → cascades to all collaborators
      await this.prisma.notebook.delete({ where: { id } });
      return { message: 'Notebook deleted successfully' };
    }

    // Not the owner — check if collaborator
    const collab = notebook.collaborators.find((c) => c.userId === userId);
    if (!collab)
      throw new ForbiddenException('You do not have access to this notebook');

    // Soft-hide instead of delete
    await this.prisma.notebookCollaborator.update({
      where: { notebookId_userId: { notebookId: id, userId } },
      data: { isHidden: true },
    });

    return { message: 'Notebook removed from your shared list' };
  }

  // =========================================================================
  // COLLABORATION
  // =========================================================================

  /**
   * Share a notebook — creates a COPY with a share token.
   * The original notebook is never modified.
   */
  async shareNotebook(
    id: string,
    userId: string,
  ): Promise<{ notebookId: string; shareToken: string }> {
    const notebook = await this.prisma.notebook.findUnique({ where: { id } });
    if (!notebook) throw new NotFoundException('Notebook not found');
    if (notebook.userId !== userId)
      throw new ForbiddenException('Only the owner can share this notebook');

    // If this notebook is already collaborative with a token, return existing
    if (notebook.isCollaborative && notebook.shareToken) {
      return { notebookId: notebook.id, shareToken: notebook.shareToken };
    }

    const shareToken = randomBytes(16).toString('hex');

    // Create a copy for collaboration
    const copy = await this.prisma.notebook.create({
      data: {
        userId,
        title: `${notebook.title} (Shared)`,
        content: notebook.content,
        orderIndex: 0,
        isCollaborative: true,
        shareToken,
        originalId: notebook.id,
      },
    });

    // Owner is also a collaborator
    await this.prisma.notebookCollaborator.create({
      data: { notebookId: copy.id, userId },
    });

    this.logger.log(
      `[shareNotebook] User ${userId} shared notebook ${id} → copy ${copy.id}, token: ${shareToken}`,
    );

    return { notebookId: copy.id, shareToken };
  }

  /**
   * Join a shared notebook via invite token.
   */
  async joinByToken(
    token: string,
    userId: string,
  ): Promise<{ notebookId: string; title: string }> {
    const notebook = await this.prisma.notebook.findUnique({
      where: { shareToken: token },
    });

    if (!notebook) throw new NotFoundException('Invalid or expired share link');
    if (!notebook.isCollaborative)
      throw new BadRequestException('This notebook is not shared');

    // Check if already a collaborator
    const existing = await this.prisma.notebookCollaborator.findUnique({
      where: {
        notebookId_userId: { notebookId: notebook.id, userId },
      },
    });

    if (existing) {
      // If they had previously hidden it, un-hide it
      if (existing.isHidden) {
        await this.prisma.notebookCollaborator.update({
          where: { notebookId_userId: { notebookId: notebook.id, userId } },
          data: { isHidden: false },
        });
        this.logger.log(
          `[joinByToken] User ${userId} re-joined (un-hid) notebook ${notebook.id}`,
        );
      }
    } else {
      await this.prisma.notebookCollaborator.create({
        data: { notebookId: notebook.id, userId },
      });
      this.logger.log(
        `[joinByToken] User ${userId} joined notebook ${notebook.id}`,
      );
    }

    return { notebookId: notebook.id, title: notebook.title };
  }

  /**
   * Get a collaborative notebook — accessible by any collaborator.
   */
  async findCollaborative(
    id: string,
    userId: string,
  ): Promise<NotebookDetailDto> {
    const notebook = await this.prisma.notebook.findUnique({
      where: { id },
      include: {
        collaborators: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!notebook) throw new NotFoundException('Notebook not found');

    // Check access: owner or collaborator
    const isOwner = notebook.userId === userId;
    const isCollaborator = notebook.collaborators.some(
      (c) => c.userId === userId,
    );

    if (!isOwner && !isCollaborator)
      throw new ForbiddenException('You do not have access to this notebook');

    return notebook as any;
  }

  /**
   * Update a collaborative notebook — any collaborator can update.
   */
  async updateCollaborative(
    id: string,
    userId: string,
    dto: UpdateNotebookDto,
  ): Promise<NotebookDetailDto> {
    const notebook = await this.prisma.notebook.findUnique({
      where: { id },
      include: { collaborators: true },
    });

    if (!notebook) throw new NotFoundException('Notebook not found');

    // Check access: owner or collaborator
    const isOwner = notebook.userId === userId;
    const isCollaborator = notebook.collaborators.some(
      (c) => c.userId === userId,
    );

    if (!isOwner && !isCollaborator)
      throw new ForbiddenException('You do not have access to this notebook');

    const updated = await this.prisma.notebook.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
      },
    });

    return updated as NotebookDetailDto;
  }
}
