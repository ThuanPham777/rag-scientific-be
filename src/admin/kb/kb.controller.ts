import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { KbService } from './kb.service';

@Controller('admin/kb')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
export class KbController {
    constructor(private readonly kbService: KbService) { }

    // ─── CATEGORIES ────────────────────────────────────────────────

    @Get('categories')
    async getCategories() {
        const tree = await this.kbService.getCategoryTree();
        return { success: true, data: tree };
    }

    @Post('categories')
    async createCategory(
        @Body() body: { name: string; slug: string; description?: string; parentId?: string },
    ) {
        const category = await this.kbService.createCategory(body);
        return { success: true, data: category };
    }

    @Patch('categories/:id')
    async updateCategory(
        @Param('id') id: string,
        @Body() body: { name?: string; slug?: string; description?: string },
    ) {
        const category = await this.kbService.updateCategory(id, body);
        return { success: true, data: category };
    }

    @Delete('categories/:id')
    async deleteCategory(@Param('id') id: string) {
        await this.kbService.deleteCategory(id);
        return { success: true };
    }

    // ─── PAPERS ────────────────────────────────────────────────────

    @Get('papers')
    async listPapers(
        @Query('categoryId') categoryId?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const result = await this.kbService.listKbPapers({
            categoryId,
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20,
        });
        return { success: true, ...result };
    }

    @Post('papers/:id/add')
    async addPaperToKb(
        @Param('id') paperId: string,
        @Body('categoryIds') categoryIds: string[],
    ) {
        const paper = await this.kbService.addPaperToKb(paperId, categoryIds);
        return { success: true, data: paper };
    }

    @Delete('papers/:id')
    async deletePaper(@Param('id') paperId: string) {
        const result = await this.kbService.deletePaper(paperId);
        return { success: true, data: result };
    }

    @Post('papers/bulk-remove')
    async bulkRemovePapers(@Body('paperIds') paperIds: string[]) {
        const result = await this.kbService.bulkRemoveFromKb(paperIds);
        return { success: true, data: result };
    }

    // ─── CLASSIFICATION ────────────────────────────────────────────

    @Post('papers/:id/classify')
    async classifyPaper(@Param('id') paperId: string) {
        const result = await this.kbService.classifyPaper(paperId);
        return { success: true, data: result };
    }

    // ─── INGEST WIZARD ──────────────────────────────────────────────

    @Get('all-papers')
    async listAllPapers(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
    ) {
        const result = await this.kbService.listAllPapers({
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20,
            search,
        });
        return { success: true, ...result };
    }

    @Get('papers/:id/chunks')
    async getChunksPreview(
        @Param('id') paperId: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const result = await this.kbService.getChunksPreview(
            paperId,
            page ? parseInt(page, 10) : 1,
            limit ? parseInt(limit, 10) : 20,
        );
        return { success: true, ...result };
    }

    @Patch('papers/:id/tags')
    async updatePaperTags(
        @Param('id') paperId: string,
        @Body('tags') tags: string[],
    ) {
        const result = await this.kbService.updatePaperTags(paperId, tags);
        return { success: true, data: result };
    }

    @Post('ingest')
    async ingestPaper(
        @Req() req: any,
        @Body() body: { fileName: string; fileUrl: string; fileSize?: number },
    ) {
        const userId = req.user?.sub || req.user?.id;
        const result = await this.kbService.ingestNewPaper(userId, body);
        return { success: true, data: result };
    }

    @Get('papers/:id/status')
    async getPaperStatus(@Param('id') paperId: string) {
        const result = await this.kbService.getPaperStatus(paperId);
        return { success: true, data: result };
    }

    // ─── KB EXPLORER (Vector Store Inspection) ───────────────────────

    @Get('explorer/stats')
    async getExplorerStats() {
        const stats = await this.kbService.getExplorerStats();
        return stats;
    }

    @Get('explorer/duplicates')
    async getExplorerDuplicates() {
        const data = await this.kbService.getExplorerDuplicates();
        return data;
    }

    @Get('explorer/chunks')
    async getExplorerChunks(
        @Query('collection') collection?: string,
        @Query('paper_id') paperId?: string,
        @Query('category') category?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const data = await this.kbService.getExplorerChunks({
            collection: collection || 'content_store',
            paper_id: paperId,
            category,
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20,
        });
        return data;
    }

    // ─── BATCH INGEST ───────────────────────────────────────────────

    @Get('mapping-template')
    getMappingTemplate(@Res() res: any) {
        const csv = this.kbService.getMappingTemplate();
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="kb_mapping_template.csv"');
        res.send(csv);
    }

    @Post('batch-ingest')
    async batchIngest(
        @Req() req: any,
        @Body() body: {
            files: {
                fileName: string;
                fileUrl: string;
                fileSize?: number;
                categorySlugs?: string[];
                tags?: string[];
            }[];
        },
    ) {
        const userId = req.user?.sub || req.user?.id;
        const result = await this.kbService.batchIngestPapers(userId, body.files);
        return { success: true, data: result };
    }
}
