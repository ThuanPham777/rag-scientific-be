import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class KbService {
    private readonly logger = new Logger(KbService.name);
    // RAG service URL from environment
    private readonly ragUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8000';

    constructor(private readonly prisma: PrismaService) { }

    // ─── CATEGORY CRUD ─────────────────────────────────────────────

    async createCategory(data: {
        name: string;
        slug: string;
        description?: string;
        parentId?: string;
    }) {
        // Check parent exists if provided
        if (data.parentId) {
            const parent = await this.prisma.kbCategory.findUnique({
                where: { id: data.parentId },
            });
            if (!parent) {
                throw new NotFoundException(`Parent category "${data.parentId}" not found`);
            }
        }

        return this.prisma.kbCategory.create({
            data: {
                name: data.name,
                slug: data.slug,
                description: data.description,
                parentId: data.parentId || null,
            },
        });
    }

    async updateCategory(id: string, data: { name?: string; slug?: string; description?: string }) {
        const existing = await this.prisma.kbCategory.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Category "${id}" not found`);

        return this.prisma.kbCategory.update({
            where: { id },
            data,
        });
    }

    async deleteCategory(id: string) {
        const category = await this.prisma.kbCategory.findUnique({
            where: { id },
            include: { papers: true },
        });
        if (!category) throw new NotFoundException(`Category "${id}" not found`);

        // Reassign papers to parent category (or unassign)
        if (category.papers.length > 0 && category.parentId) {
            await this.prisma.kbPaperCategory.updateMany({
                where: { categoryId: id },
                data: { categoryId: category.parentId },
            });
        } else {
            // No parent → delete associations
            await this.prisma.kbPaperCategory.deleteMany({
                where: { categoryId: id },
            });
        }

        // Move child categories to parent
        await this.prisma.kbCategory.updateMany({
            where: { parentId: id },
            data: { parentId: category.parentId },
        });

        return this.prisma.kbCategory.delete({ where: { id } });
    }

    async getCategoryTree() {
        const categories = await this.prisma.kbCategory.findMany({
            include: {
                _count: { select: { papers: true } },
            },
            orderBy: { name: 'asc' },
        });

        // Build tree structure
        const map = new Map<string, any>();
        const roots: any[] = [];

        for (const cat of categories) {
            map.set(cat.id, { ...cat, children: [], paperCount: cat._count.papers });
        }

        for (const cat of categories) {
            const node = map.get(cat.id);
            if (cat.parentId && map.has(cat.parentId)) {
                map.get(cat.parentId).children.push(node);
            } else {
                roots.push(node);
            }
        }

        return roots;
    }

    // ─── KB PAPERS ─────────────────────────────────────────────────

    async addPaperToKb(
        paperId: string,
        categoryIds: string[],
    ) {
        const paper = await this.prisma.paper.findUnique({ where: { id: paperId } });
        if (!paper) throw new NotFoundException(`Paper "${paperId}" not found`);

        // Mark as system KB
        await this.prisma.paper.update({
            where: { id: paperId },
            data: { isSystemKb: true },
        });

        // Create category associations
        for (const categoryId of categoryIds) {
            await this.prisma.kbPaperCategory.upsert({
                where: {
                    paperId_categoryId: { paperId, categoryId },
                },
                create: { paperId, categoryId },
                update: {},
            });
        }

        // Update paper counts
        await this.updatePaperCounts();

        return {
            ...paper,
            fileSize: paper.fileSize ? Number(paper.fileSize) : null,
        };
    }

    async removePaperFromKb(paperId: string) {
        const paper = await this.prisma.paper.findUnique({ where: { id: paperId } });
        if (!paper) throw new NotFoundException(`Paper "${paperId}" not found`);

        await this.prisma.paper.update({
            where: { id: paperId },
            data: { isSystemKb: false },
        });

        await this.prisma.kbPaperCategory.deleteMany({
            where: { paperId },
        });

        await this.updatePaperCounts();
        return {
            ...paper,
            fileSize: paper.fileSize ? Number(paper.fileSize) : null,
        };
    }

    async bulkRemoveFromKb(paperIds: string[]) {
        if (!paperIds?.length) return { removed: 0 };

        // Unmark from system KB
        await this.prisma.paper.updateMany({
            where: { id: { in: paperIds } },
            data: { isSystemKb: false },
        });

        // Remove category associations
        await this.prisma.kbPaperCategory.deleteMany({
            where: { paperId: { in: paperIds } },
        });

        await this.updatePaperCounts();
        return { removed: paperIds.length };
    }

    async deletePaper(paperId: string) {
        const paper = await this.prisma.paper.findUnique({ where: { id: paperId } });
        if (!paper) throw new NotFoundException(`Paper "${paperId}" not found`);

        // 1. Delete chunks from RAG vector store
        try {
            await axios.delete(`${this.ragUrl}/papers/${paper.ragFileId}/chunks`);
        } catch (err: any) {
            this.logger.warn(`RAG chunk cleanup failed for ${paperId}: ${err?.message}`);
        }

        // 2. Delete related DB records
        await this.prisma.kbPaperCategory.deleteMany({ where: { paperId } });
        await this.prisma.conversationPaper.deleteMany({ where: { paperId } });
        await this.prisma.highlight.deleteMany({ where: { paperId } });
        await this.prisma.relatedPaper.deleteMany({ where: { paperId } });

        // 3. Delete the paper itself
        await this.prisma.paper.delete({ where: { id: paperId } });

        // 4. Update category counts
        await this.updatePaperCounts();

        return { deleted: true, paperId };
    }

    async listKbPapers(params: {
        categoryId?: string;
        page?: number;
        limit?: number;
    }) {
        const { categoryId, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        const where: any = { isSystemKb: true };
        if (categoryId) {
            where.kbPaperCategories = {
                some: { categoryId },
            };
        }

        const [papers, total] = await Promise.all([
            this.prisma.paper.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    kbPaperCategories: {
                        include: { category: true },
                    },
                },
            }),
            this.prisma.paper.count({ where }),
        ]);

        // Convert BigInt fileSize to Number for JSON serialization
        const safePapers = papers.map((p) => ({
            ...p,
            fileSize: p.fileSize ? Number(p.fileSize) : null,
        }));

        return {
            papers: safePapers,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    // ─── CLASSIFICATION ────────────────────────────────────────────

    async classifyPaper(paperId: string) {
        const paper = await this.prisma.paper.findUnique({ where: { id: paperId } });
        if (!paper) throw new NotFoundException(`Paper "${paperId}" not found`);

        const titleUsed = paper.title || paper.fileName;
        this.logger.log(`Classifying paper "${paperId}" with title: "${titleUsed}"`);

        try {
            const response = await axios.post(`${this.ragUrl}/classify-paper`, {
                title: titleUsed,
                abstract: paper.abstract || '',
            });
            const result = response.data;
            this.logger.log(`Classify result — source: ${result.source}, categories: ${JSON.stringify(result.categories?.map((c: any) => c.slug))}`);
            return result;
        } catch (error: any) {
            this.logger.error(`Classification failed: ${error.message}`);
            throw new BadRequestException('Classification failed');
        }
    }

    // ─── HELPERS ───────────────────────────────────────────────────

    private async updatePaperCounts() {
        const categories = await this.prisma.kbCategory.findMany({
            include: { _count: { select: { papers: true } } },
        });

        for (const cat of categories) {
            await this.prisma.kbCategory.update({
                where: { id: cat.id },
                data: { paperCount: cat._count.papers },
            });
        }
    }

    // ─── INGEST WIZARD ────────────────────────────────────────────

    async listAllPapers(params: {
        page?: number;
        limit?: number;
        search?: string;
    }) {
        const { page = 1, limit = 20, search } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.OR = [
                { fileName: { contains: search, mode: 'insensitive' } },
                { title: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [rawPapers, total] = await Promise.all([
            this.prisma.paper.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    fileName: true,
                    title: true,
                    abstract: true,
                    numPages: true,
                    status: true,
                    fileSize: true,
                    isSystemKb: true,
                    ragFileId: true,
                    createdAt: true,
                    user: {
                        select: { id: true, displayName: true, email: true },
                    },
                },
            }),
            this.prisma.paper.count({ where }),
        ]);

        // Convert BigInt fileSize to Number
        const papers = rawPapers.map((p) => ({
            ...p,
            fileSize: p.fileSize ? Number(p.fileSize) : null,
        }));

        return {
            papers,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getChunksPreview(paperId: string, page: number = 1, limit: number = 20) {
        // Look up paper to get ragFileId and determine collection
        const paper = await this.prisma.paper.findUnique({ where: { id: paperId } });
        if (!paper) throw new NotFoundException(`Paper "${paperId}" not found`);

        const collection = paper.isSystemKb ? 'system_knowledge_base' : 'content_store';

        try {
            const response = await axios.get(
                `${this.ragUrl}/inspect/chunks`,
                {
                    params: {
                        paper_id: paper.ragFileId,
                        collection,
                        page,
                        limit,
                    },
                },
            );
            return response.data;
        } catch (error: any) {
            this.logger.error(`Chunks preview failed: ${error.message}`);
            return { chunks: [], total: 0 };
        }
    }

    async updatePaperTags(paperId: string, tags: string[]) {
        const paper = await this.prisma.paper.findUnique({ where: { id: paperId } });
        if (!paper) throw new NotFoundException(`Paper "${paperId}" not found`);

        return this.prisma.paper.update({
            where: { id: paperId },
            data: { kbTags: tags },
        });
    }

    // ─── INGEST NEW PAPER FOR SYSTEM KB ──────────────────────────

    async ingestNewPaper(
        userId: string,
        data: { fileName: string; fileUrl: string; fileSize?: number },
    ) {
        const ragFileId = crypto.randomUUID();

        const paper = await this.prisma.paper.create({
            data: {
                userId,
                fileName: data.fileName,
                fileUrl: data.fileUrl,
                fileSize: data.fileSize ? BigInt(data.fileSize) : null,
                ragFileId,
                status: 'PENDING',
                isSystemKb: true,
            },
        });

        // Trigger RAG ingest in background
        this.triggerRagIngest(paper.id, ragFileId, data.fileUrl);

        return {
            id: paper.id,
            fileName: paper.fileName,
            ragFileId: paper.ragFileId,
            status: paper.status,
            isSystemKb: true,
        };
    }

    private async triggerRagIngest(paperId: string, ragFileId: string, fileUrl: string) {
        try {
            await this.prisma.paper.update({
                where: { id: paperId },
                data: { status: 'PROCESSING' },
            });

            const response = await axios.post(`${this.ragUrl}/ingest-from-url`, {
                file_url: fileUrl,
                file_id: ragFileId,
                collection: 'system_knowledge_base',
            });

            const result = response.data;
            const authorsJson = Array.isArray(result.authors)
                ? JSON.stringify(result.authors) : result.authors || null;

            await this.prisma.paper.update({
                where: { id: paperId },
                data: {
                    status: 'COMPLETED',
                    title: result.title,
                    abstract: result.abstract,
                    authors: authorsJson,
                    numPages: result.num_pages,
                    nodeCount: result.node_count,
                    tableCount: result.table_count,
                    imageCount: result.image_count,
                    processedAt: new Date(),
                },
            });
        } catch (error: any) {
            this.logger.error('KB RAG ingestion failed:', error?.message);
            await this.prisma.paper.update({
                where: { id: paperId },
                data: {
                    status: 'FAILED',
                    errorMessage: error?.message ?? 'RAG ingestion failed',
                },
            });
        }
    }

    async getPaperStatus(paperId: string) {
        const paper = await this.prisma.paper.findUnique({
            where: { id: paperId },
            select: {
                id: true,
                status: true,
                title: true,
                fileName: true,
                numPages: true,
                ragFileId: true,
                errorMessage: true,
            },
        });
        if (!paper) throw new NotFoundException(`Paper "${paperId}" not found`);
        return paper;
    }
    // ─── KB EXPLORER (Vector Store Inspection) ────────────────────

    async getExplorerStats() {
        try {
            const response = await axios.get(`${this.ragUrl}/inspect/collection-stats`);
            return response.data;
        } catch (error: any) {
            this.logger.error(`Explorer stats failed: ${error.message}`);
            return {};
        }
    }

    async getExplorerDuplicates() {
        try {
            const response = await axios.get(`${this.ragUrl}/inspect/duplicates`);
            return response.data;
        } catch (error: any) {
            this.logger.error(`Explorer duplicates failed: ${error.message}`);
            return { duplicates: [], total: 0 };
        }
    }

    async getExplorerChunks(params: {
        collection?: string;
        paper_id?: string;
        category?: string;
        page?: number;
        limit?: number;
    }) {
        try {
            const response = await axios.get(`${this.ragUrl}/inspect/chunks`, { params });
            return response.data;
        } catch (error: any) {
            this.logger.error(`Explorer chunks failed: ${error.message}`);
            return { chunks: [], total: 0, page: 1, limit: 20, totalPages: 0 };
        }
    }

    // ─── BATCH INGEST ────────────────────────────────────────────────

    getMappingTemplate(): string {
        return [
            'fileName,categories,tags',
            'example_paper.pdf,"artificial_intelligence,machine_learning","transformer,attention mechanism"',
            'another_paper.pdf,"computer_vision","image segmentation,cnn"',
        ].join('\n');
    }

    async batchIngestPapers(
        userId: string,
        files: {
            fileName: string;
            fileUrl: string;
            fileSize?: number;
            categorySlugs?: string[];
            tags?: string[];
        }[],
    ) {
        const results: {
            fileName: string;
            paperId: string | null;
            status: 'queued' | 'failed';
            error?: string;
        }[] = [];

        for (const file of files) {
            try {
                // 1. Ingest paper (creates DB record + triggers RAG)
                const paper = await this.ingestNewPaper(userId, {
                    fileName: file.fileName,
                    fileUrl: file.fileUrl,
                    fileSize: file.fileSize,
                });

                // 2. Resolve category slugs → IDs and assign
                if (file.categorySlugs?.length) {
                    const categories = await this.prisma.kbCategory.findMany({
                        where: { slug: { in: file.categorySlugs } },
                    });
                    const categoryIds = categories.map((c) => c.id);
                    if (categoryIds.length) {
                        for (const categoryId of categoryIds) {
                            await this.prisma.kbPaperCategory.upsert({
                                where: { paperId_categoryId: { paperId: paper.id, categoryId } },
                                create: { paperId: paper.id, categoryId },
                                update: {},
                            });
                        }
                    }
                }

                // 3. Assign tags
                if (file.tags?.length) {
                    await this.prisma.paper.update({
                        where: { id: paper.id },
                        data: { kbTags: file.tags },
                    });
                }

                results.push({
                    fileName: file.fileName,
                    paperId: paper.id,
                    status: 'queued',
                });
            } catch (err: any) {
                results.push({
                    fileName: file.fileName,
                    paperId: null,
                    status: 'failed',
                    error: err?.message || 'Unknown error',
                });
            }
        }

        await this.updatePaperCounts();
        return { results, total: files.length };
    }
}
