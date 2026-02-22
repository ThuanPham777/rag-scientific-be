import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFolderDto, UpdateFolderDto, MovePaperDto } from './dto/index';
import {
  FolderItemDto,
  FolderWithPapersDto,
  DeleteFolderResultDto,
  MovePaperResultDto,
} from './dto/folder-response.dto';
import { PaperItemDto } from '../paper/dto/create-paper-response.dto';

@Injectable()
export class FolderService {
  private readonly logger = new Logger(FolderService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get all folders for a user
   * @returns Raw array of folders
   */
  async findAllByUser(userId: string): Promise<FolderItemDto[]> {
    const folders = await this.prisma.folder.findMany({
      where: { userId },
      include: {
        _count: {
          select: { papers: true },
        },
      },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'desc' }],
    });

    return folders as FolderItemDto[];
  }

  /**
   * Get a single folder with papers
   * @returns Raw folder with papers
   */
  async findOne(id: string, userId: string): Promise<FolderWithPapersDto> {
    const folder = await this.prisma.folder.findUnique({
      where: { id },
      include: {
        papers: {
          // Exclude group papers (defense in depth — they should never be in a folder)
          where: {
            conversations: { none: { type: 'GROUP' } },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            ragFileId: true,
            title: true,
            abstract: true,
            authors: true,
            numPages: true,
            status: true,
            createdAt: true,
          },
        },
        _count: {
          select: { papers: true },
        },
      },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    if (folder.userId !== userId) {
      throw new ForbiddenException('You do not have access to this folder');
    }

    return folder as unknown as FolderWithPapersDto;
  }

  /**
   * Create a new folder
   * @returns Raw created folder
   */
  async create(userId: string, dto: CreateFolderDto): Promise<FolderItemDto> {
    // Check for duplicate name
    const existing = await this.prisma.folder.findUnique({
      where: {
        userId_name: {
          userId,
          name: dto.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException('A folder with this name already exists');
    }

    // Get max order index
    const maxOrder = await this.prisma.folder.aggregate({
      where: { userId },
      _max: { orderIndex: true },
    });

    const folder = await this.prisma.folder.create({
      data: {
        userId,
        name: dto.name,
        orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
      },
      include: {
        _count: {
          select: { papers: true },
        },
      },
    });

    return folder as FolderItemDto;
  }

  /**
   * Update a folder
   * @returns Raw updated folder
   */
  async update(
    id: string,
    userId: string,
    dto: UpdateFolderDto,
  ): Promise<FolderItemDto> {
    const folder = await this.prisma.folder.findUnique({
      where: { id },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    if (folder.userId !== userId) {
      throw new ForbiddenException('You do not have access to this folder');
    }

    // Check for duplicate name if name is being changed
    if (dto.name && dto.name !== folder.name) {
      const existing = await this.prisma.folder.findUnique({
        where: {
          userId_name: {
            userId,
            name: dto.name,
          },
        },
      });

      if (existing) {
        throw new ConflictException('A folder with this name already exists');
      }
    }

    const updatedFolder = await this.prisma.folder.update({
      where: { id },
      data: dto,
      include: {
        _count: {
          select: { papers: true },
        },
      },
    });

    return updatedFolder as FolderItemDto;
  }

  /**
   * Delete a folder.
   * Papers in the folder are NOT deleted — they are moved to Uncategorized
   * (folderId set to null) via the schema's onDelete: SetNull rule.
   * S3 files and RAG data are preserved since the papers still exist.
   * @returns Raw delete result with count of released papers
   */
  async remove(id: string, userId: string): Promise<DeleteFolderResultDto> {
    const folder = await this.prisma.folder.findUnique({
      where: { id },
      include: {
        _count: { select: { papers: true } },
      },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    if (folder.userId !== userId) {
      throw new ForbiddenException('You do not have access to this folder');
    }

    const paperCount = folder._count.papers;

    // Delete folder only — papers survive with folderId = null (onDelete: SetNull)
    await this.prisma.folder.delete({
      where: { id },
    });

    return {
      message: 'Folder deleted successfully',
      deletedPapers: paperCount,
    };
  }

  /**
   * Move a paper to a folder (or remove from folder).
   * Group papers (linked to GROUP conversations) cannot be moved to folders.
   * @returns Raw updated paper data
   */
  async movePaper(
    paperId: string,
    userId: string,
    dto: MovePaperDto,
  ): Promise<MovePaperResultDto> {
    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
      include: {
        conversations: {
          where: { type: 'GROUP' },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    if (paper.userId !== userId) {
      throw new ForbiddenException('You do not have access to this paper');
    }

    // Group papers must NOT belong to any folder — they are tied to conversations
    if (dto.folderId && paper.conversations.length > 0) {
      throw new ForbiddenException(
        'Group papers cannot be moved to a folder. They are tied to collaborative conversations.',
      );
    }

    // If moving to a folder, verify folder exists and belongs to user
    if (dto.folderId) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: dto.folderId },
      });

      if (!folder) {
        throw new NotFoundException('Folder not found');
      }

      if (folder.userId !== userId) {
        throw new ForbiddenException('You do not have access to this folder');
      }
    }

    const updatedPaper = await this.prisma.paper.update({
      where: { id: paperId },
      data: { folderId: dto.folderId || null },
      select: {
        id: true,
        fileName: true,
        ragFileId: true,
        title: true,
        folderId: true,
      },
    });

    return updatedPaper as MovePaperResultDto;
  }

  /**
   * Get all uncategorized papers (papers without a folder).
   * Excludes group papers — those are tied to conversations, not folders.
   * @returns Raw array of papers
   */
  async getUncategorizedPapers(userId: string): Promise<PaperItemDto[]> {
    const papers = await this.prisma.paper.findMany({
      where: {
        userId,
        folderId: null,
        // Exclude group papers (linked to GROUP conversations)
        conversations: {
          none: { type: 'GROUP' },
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        ragFileId: true,
        title: true,
        abstract: true,
        authors: true,
        numPages: true,
        status: true,
        createdAt: true,
      },
    });

    return papers as PaperItemDto[];
  }
}
