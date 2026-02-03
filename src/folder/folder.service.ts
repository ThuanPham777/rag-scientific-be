import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../upload/s3.service';
import { CreateFolderDto, UpdateFolderDto, MovePaperDto } from './dto';
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
  private readonly ragBaseUrl: string;

  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private configService: ConfigService,
  ) {
    this.ragBaseUrl =
      this.configService.get<string>('RAG_API_URL') || 'http://localhost:8000';
  }

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
    console.log('userId', userId, 'dto.name', dto.name);
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
   * Delete a folder and ALL papers in it (cascade delete)
   * This will also delete:
   * - All conversations and messages
   * - All suggested questions
   * - All related papers cache
   * - S3 files (PDFs and chat images)
   * - RAG vectorstore data
   * @returns Raw delete result with paper count
   */
  async remove(id: string, userId: string): Promise<DeleteFolderResultDto> {
    const folder = await this.prisma.folder.findUnique({
      where: { id },
      include: {
        papers: {
          select: {
            id: true,
            fileUrl: true,
            ragFileId: true,
          },
        },
      },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    if (folder.userId !== userId) {
      throw new ForbiddenException('You do not have access to this folder');
    }

    const papers = folder.papers;
    const paperCount = papers.length;

    // Collect all S3 URLs to delete (paper files + chat images)
    const s3UrlsToDelete: string[] = [];
    const ragFileIdsToDelete: string[] = [];

    for (const paper of papers) {
      // Paper PDF file
      if (paper.fileUrl) {
        s3UrlsToDelete.push(paper.fileUrl);
      }
      // RAG file ID for vectorstore cleanup
      if (paper.ragFileId) {
        ragFileIdsToDelete.push(paper.ragFileId);
      }
    }

    // Get all chat image URLs from messages
    if (paperCount > 0) {
      const paperIds = papers.map((p) => p.id);
      const messages = await this.prisma.message.findMany({
        where: {
          conversation: {
            paperId: { in: paperIds },
          },
          imageUrl: { not: null },
        },
        select: { imageUrl: true },
      });

      for (const msg of messages) {
        if (msg.imageUrl) {
          s3UrlsToDelete.push(msg.imageUrl);
        }
      }
    }

    // Delete from RAG vectorstore (fire and forget - don't block on errors)
    for (const ragFileId of ragFileIdsToDelete) {
      this.deleteFromRag(ragFileId).catch((err) => {
        this.logger.warn(`Failed to delete from RAG: ${ragFileId}`, err);
      });
    }

    // Delete S3 files (fire and forget - don't block on errors)
    if (s3UrlsToDelete.length > 0) {
      this.s3Service.deleteFiles(s3UrlsToDelete).catch((err) => {
        this.logger.warn('Failed to delete S3 files:', err);
      });
    }

    // Delete folder (cascade will delete papers and all related records)
    await this.prisma.folder.delete({
      where: { id },
    });

    return {
      message: 'Folder deleted successfully',
      deletedPapers: paperCount,
    };
  }

  /**
   * Delete file from RAG service vectorstore
   */
  private async deleteFromRag(ragFileId: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.ragBaseUrl}/delete-file/${ragFileId}`,
        {
          method: 'DELETE',
        },
      );
      if (response.ok) {
        this.logger.log(`Deleted from RAG: ${ragFileId}`);
      } else {
        this.logger.warn(
          `RAG delete returned ${response.status} for ${ragFileId}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to delete from RAG: ${ragFileId}`, error);
    }
  }

  /**
   * Move a paper to a folder (or remove from folder)
   * @returns Raw updated paper data
   */
  async movePaper(
    paperId: string,
    userId: string,
    dto: MovePaperDto,
  ): Promise<MovePaperResultDto> {
    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
    });

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    if (paper.userId !== userId) {
      throw new ForbiddenException('You do not have access to this paper');
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
   * Get all uncategorized papers (papers without a folder)
   * @returns Raw array of papers
   */
  async getUncategorizedPapers(userId: string): Promise<PaperItemDto[]> {
    const papers = await this.prisma.paper.findMany({
      where: {
        userId,
        folderId: null,
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
