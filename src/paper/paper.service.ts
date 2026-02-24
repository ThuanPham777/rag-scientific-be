import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../upload/s3.service';
import { RagService } from '../rag/index';
import { SessionService } from '../session/session.service';
import { CreatePaperRequestDto } from './dto/create-paper-request.dto';
import { PaperItemDto } from './dto/create-paper-response.dto';
import { RelatedPapersResultDto } from './dto/related-papers.dto';
import { PaperSummaryDto } from './dto/paper-summary.dto';

@Injectable()
export class PaperService {
  private readonly logger = new Logger(PaperService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragService: RagService,
    private readonly s3Service: S3Service,
    private readonly sessionService: SessionService,
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
    dto.summary = p.summary ?? null;
    dto.authors = p.authors ?? null;
    dto.numPages = p.numPages ?? null;
    dto.status = p.status;
    dto.nodeCount = p.nodeCount ?? null;
    dto.tableCount = p.tableCount ?? null;
    dto.imageCount = p.imageCount ?? null;
    dto.createdAt = p.createdAt;
    dto.processedAt = p.processedAt ?? null;
    return dto;
  }

  /**
   * Create a new paper and trigger RAG ingestion.
   * Optionally assigns to a folder (private UI organization).
   * @returns Raw paper item
   */
  async createPaper(
    userId: string,
    dto: CreatePaperRequestDto,
  ): Promise<PaperItemDto> {
    // Validate folder ownership if folderId provided
    if (dto.folderId) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: dto.folderId },
      });
      if (!folder || folder.userId !== userId) {
        throw new ForbiddenException('Folder not found or not owned by user');
      }
    }

    // Generate ragFileId (UUID for RAG service)
    const ragFileId = crypto.randomUUID();

    const paper = await this.prisma.paper.create({
      data: {
        userId,
        folderId: dto.folderId || null,
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

    return this.mapToPaperItem(paper);
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

      // Call RAG service via centralized RagService
      const response = await this.ragService.ingestFromUrl(fileUrl, ragFileId);

      // Update paper with metadata from RAG
      // Note: authors comes as array from RAG, serialize to JSON string for storage
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
      this.logger.error('RAG ingestion failed:', error);
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
   * List all papers for a user (owned + shared via collaborative sessions)
   * Excludes papers with active GROUP conversations where the owner is not an active member
   * @returns Raw array of papers
   */
  async listMyPapers(
    userId: string,
    limit: number = 20,
    cursor?: string,
  ): Promise<{
    items: PaperItemDto[];
    nextCursor?: string;
  }> {
    const papers = await this.prisma.paper.findMany({
      where: {
        OR: [
          // Papers owned by the user
          { userId },
          // Papers shared via collaborative sessions
          {
            conversations: {
              some: {
                isCollaborative: true,
                sessionMembers: {
                  some: { userId, isActive: true },
                },
              },
            },
          },
        ],
      },
      take: limit + 1, // lấy dư 1 record
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        conversations: {
          where: {
            type: 'GROUP',
            isCollaborative: true,
          },
          include: {
            sessionMembers: {
              where: { isActive: true },
              select: { userId: true, isActive: true },
            },
          },
        },
      },
    });

    // Filter out papers with active GROUP conversations where owner is not an active member
    const filtered = papers.filter((paper) => {
      // If paper doesn't belong to this user, always include (they're a session member)
      if (paper.userId !== userId) return true;

      // Check if paper has an active GROUP conversation (with at least one active member)
      const activeGroupConv = paper.conversations.find(
        (conv) => conv.sessionMembers.length > 0,
      );

      if (!activeGroupConv) {
        // No active GROUP conversation, include the paper
        return true;
      }

      // Paper has active GROUP conversation - check if owner is an active member
      const ownerMembership = activeGroupConv.sessionMembers.find(
        (m) => m.userId === userId,
      );
      return !!ownerMembership;
    });

    let nextCursor: string | undefined;

    if (filtered.length > limit) {
      filtered.pop(); // remove extra record used for hasMore check
      nextCursor = filtered[filtered.length - 1]?.id; // cursor = last item of current page
    }

    const items = filtered.map((p) => this.mapToPaperItem(p));

    return {
      items,
      nextCursor,
    };
  }

  /**
   * Get paper by ID
   * Access: owner, PaperShare, or session member
   * @returns Raw paper item
   */
  async getPaperById(userId: string, id: string): Promise<PaperItemDto> {
    // Try ownership first
    let paper = await this.prisma.paper.findFirst({
      where: { id, userId },
    });

    // If not found as owner, check session membership on any collaborative conversation for this paper
    if (!paper) {
      const conversation = await this.prisma.conversation.findFirst({
        where: { paperId: id, isCollaborative: true },
      });
      if (conversation) {
        const { hasAccess } = await this.sessionService.checkAccess(
          userId,
          conversation.id,
        );
        if (hasAccess) {
          paper = await this.prisma.paper.findFirst({ where: { id } });
        }
      }
    }

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    return this.mapToPaperItem(paper);
  }

  /**
   * Get paper by RAG file ID
   * @returns Raw paper item
   */
  async getPaperByRagFileId(
    userId: string,
    ragFileId: string,
  ): Promise<PaperItemDto> {
    const paper = await this.prisma.paper.findFirst({
      where: { ragFileId, userId },
    });

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    return this.mapToPaperItem(paper);
  }

  /**
   * Delete a paper and cleanup all associated resources
   * - Deletes from database (cascades to conversations, messages, etc.)
   * - Deletes file from S3
   * - Calls RAG service to cleanup vector store and caches
   *
   * Permission rules:
   * - Paper owner can always delete if no active GROUP conversations exist
   * - If paper has active GROUP conversation, only GROUP owner can delete
   */
  async deletePaper(userId: string, id: string): Promise<void> {
    // Find paper without userId filter to provide accurate error messages
    const paper = await this.prisma.paper.findUnique({
      where: { id },
      include: {
        conversations: {
          where: {
            type: 'GROUP',
            isCollaborative: true,
          },
          include: {
            sessionMembers: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    const isPaperOwner = paper.userId === userId;

    // Check if paper has any active GROUP conversations
    const activeGroupConv = paper.conversations.find(
      (conv) => conv.sessionMembers.length > 0,
    );

    if (activeGroupConv) {
      // Paper is in an active GROUP session - only GROUP owner can delete
      const isGroupOwner = activeGroupConv.sessionMembers.some(
        (member) => member.userId === userId && member.role === 'OWNER',
      );

      if (!isGroupOwner) {
        throw new ForbiddenException(
          'This paper is in an active collaborative session. Only the session owner can delete it.',
        );
      }
    } else {
      // No active GROUP - only paper owner can delete
      if (!isPaperOwner) {
        throw new ForbiddenException(
          'You do not have permission to delete this paper.',
        );
      }
    }

    // 1. Delete from database (cascades to related tables)
    await this.prisma.paper.delete({ where: { id } });

    // 2. Delete file from S3 (async, don't block)
    this.deleteS3File(paper.fileUrl);

    // 3. Call RAG to cleanup vector store and caches (async, don't block)
    this.cleanupRagData(paper.ragFileId);
  }

  /**
   * Delete S3 file in background
   */
  private async deleteS3File(fileUrl: string): Promise<void> {
    try {
      const deleted = await this.s3Service.deleteFile(fileUrl);
      if (deleted) {
        this.logger.log(`Deleted S3 file: ${fileUrl}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete S3 file: ${fileUrl}`, error);
    }
  }

  /**
   * Call RAG service to cleanup vector store and caches
   */
  private async cleanupRagData(ragFileId: string): Promise<void> {
    try {
      await this.ragService.cleanup(ragFileId);
      this.logger.log(`RAG cleanup completed for: ${ragFileId}`);
    } catch (error) {
      this.logger.error(`RAG cleanup failed for: ${ragFileId}`, error);
    }
  }

  // ============================================================
  // Summary, Related Papers, Brainstorm Questions
  // ============================================================

  /**
   * Generate or retrieve cached summary for a paper
   * Calls RAG service and caches result in the `summary` column
   * Supports both owner access and collaborative session access
   */
  async getSummary(userId: string, paperId: string): Promise<PaperSummaryDto> {
    // First, try to find paper owned by user
    let paper = await this.prisma.paper.findFirst({
      where: { id: paperId, userId },
    });

    // If not found, check if user has collaborative access through a session
    if (!paper) {
      paper = await this.prisma.paper.findFirst({
        where: {
          id: paperId,
          conversations: {
            some: {
              isCollaborative: true,
              sessionMembers: {
                some: { userId },
              },
            },
          },
        },
      });
    }

    if (!paper) {
      throw new NotFoundException('Paper not found or access denied');
    }

    if (paper.status !== 'COMPLETED') {
      throw new NotFoundException('Paper has not been processed yet');
    }

    // Return cached summary if available
    if (paper.summary) {
      return { paperId: paper.id, summary: paper.summary };
    }

    // Call RAG service to generate summary
    try {
      const response = await this.ragService.summarizePaper(paper.ragFileId);

      // Cache the summary in database
      await this.prisma.paper.update({
        where: { id: paperId },
        data: { summary: response.summary },
      });

      return { paperId: paper.id, summary: response.summary };
    } catch (error) {
      this.logger.error(
        `Summary generation failed for paper: ${paperId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get related papers from arXiv, with caching in `related_papers` table
   * Supports both owner access and collaborative session access
   */
  async getRelatedPapers(
    userId: string,
    paperId: string,
    topK: number = 5,
    maxResults: number = 30,
  ): Promise<RelatedPapersResultDto> {
    // First, try to find paper owned by user
    let paper = await this.prisma.paper.findFirst({
      where: { id: paperId, userId },
    });

    // If not found, check if user has collaborative access through a session
    if (!paper) {
      paper = await this.prisma.paper.findFirst({
        where: {
          id: paperId,
          conversations: {
            some: {
              isCollaborative: true,
              sessionMembers: {
                some: { userId },
              },
            },
          },
        },
      });
    }

    if (!paper) {
      throw new NotFoundException('Paper not found or access denied');
    }

    if (paper.status !== 'COMPLETED') {
      throw new NotFoundException('Paper has not been processed yet');
    }

    // Check cache first
    const cached = await this.prisma.relatedPaper.findMany({
      where: { paperId },
      orderBy: { orderIndex: 'asc' },
    });

    if (cached.length > 0) {
      return {
        paperId: paper.id,
        results: cached.map((r) => ({
          arxivId: r.arxivId,
          title: r.title,
          abstract: r.abstract,
          authors: r.authors,
          categories: r.categories,
          url: r.url,
          score: r.score,
          reason: r.reason,
          orderIndex: r.orderIndex,
        })),
        fromCache: true,
      };
    }

    // Call RAG service
    try {
      const response = await this.ragService.getRelatedPapers(
        paper.ragFileId,
        topK,
        maxResults,
      );

      // Save to database cache
      if (response.results && response.results.length > 0) {
        await this.prisma.relatedPaper.createMany({
          data: response.results.map((r, index) => ({
            paperId: paper.id,
            arxivId: r.arxiv_id,
            title: r.title,
            abstract: r.abstract,
            authors: r.authors,
            categories: r.categories,
            url: r.url,
            score: r.score,
            reason: r.reason,
            orderIndex: index,
          })),
          skipDuplicates: true,
        });
      }

      return {
        paperId: paper.id,
        results: (response.results || []).map((r, index) => ({
          arxivId: r.arxiv_id,
          title: r.title,
          abstract: r.abstract,
          authors: r.authors,
          categories: r.categories,
          url: r.url,
          score: r.score,
          reason: r.reason,
          orderIndex: index,
        })),
        fromCache: false,
      };
    } catch (error) {
      this.logger.error(
        `Related papers fetch failed for paper: ${paperId}`,
        error,
      );
      throw error;
    }
  }
}
