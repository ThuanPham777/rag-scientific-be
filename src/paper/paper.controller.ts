// src/paper/paper.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaperService } from './paper.service';
import { ChatService } from '../chat/chat.service';
import { CreatePaperRequestDto } from './dto/create-paper-request.dto';
import { CreatePaperResponseDto } from './dto/create-paper-response.dto';
import { ListPapersResponseDto } from './dto/list-papers-response.dto';
import { GetPaperResponseDto } from './dto/get-paper-response.dto';
import { DeletePaperResponseDto } from './dto/delete-paper-response.dto';
import { PaperSummaryResponseDto } from './dto/paper-summary.dto';
import {
  GetRelatedPapersRequestDto,
  RelatedPapersResponseDto,
} from './dto/related-papers.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/jwt.strategy';
import {
  ApiResponseDto,
  CursorPaginationDto,
  EmptyResponseDto,
} from '../common/dto/api-response.dto';
import { ListPaperRequestsDto } from './dto/list-papers-request.dto';

@ApiTags('papers')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('papers')
export class PaperController {
  constructor(
    private readonly paperService: PaperService,
    private readonly chatService: ChatService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Register uploaded PDF for AI analysis',
    description: `Register a PDF file that was previously uploaded to create a new paper entry.

**Processing Pipeline:**
1. Creates database entry with PENDING status
2. Triggers RAG ingestion in background
3. Extracts text, images, and tables
4. Builds vector embeddings for search
5. Updates status to COMPLETED when ready

**File Requirements:**
- PDF must be already uploaded via /upload endpoint
- Maximum 50MB file size
- Scientific papers work best

**Processing Time:** Usually 30 seconds to 5 minutes depending on paper length`,
  })
  @ApiOkResponse({ type: CreatePaperResponseDto })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreatePaperRequestDto,
  ): Promise<CreatePaperResponseDto> {
    const data = await this.paperService.createPaper(user.id, dto);
    return ApiResponseDto.success(
      data,
      'Paper created and processing started',
    ) as CreatePaperResponseDto;
  }

  @Get()
  @ApiOperation({
    summary: 'List all user papers',
    description: `Get all papers belonging to the authenticated user.

**Returned Information:**
- Basic paper metadata (title, authors, abstract)
- Processing status (PENDING, PROCESSING, COMPLETED, FAILED)
- File information (size, upload date)
- Statistics (page count, node count, etc.)

**Sorting:** Papers are returned by creation date (newest first)

**Status Meanings:**
- **PENDING**: Queued for processing
- **PROCESSING**: Currently being analyzed by RAG
- **COMPLETED**: Ready for Q&A and analysis
- **FAILED**: Processing encountered an error`,
  })
  @ApiOkResponse({ type: ListPapersResponseDto })
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query() listPaperRequestsDto: ListPaperRequestsDto,
  ): Promise<ListPapersResponseDto> {
    const { limit = 20, cursor } = listPaperRequestsDto;
    const data = await this.paperService.listMyPapers(user.id, limit, cursor);

    const pagination = new CursorPaginationDto(
      data.items,
      limit,
      data.nextCursor,
    );

    return ApiResponseDto.success(
      pagination,
      'List of papers',
    ) as ListPapersResponseDto;
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search across all user papers',
    description:
      'Performs semantic search over the contents of every paper the user has processed and returns matching snippets as citations.',
  })
  @ApiQuery({ name: 'term', required: true, description: 'Search term' })
  async search(
    @CurrentUser() user: CurrentUserPayload,
    @Query('term') term: string,
  ) {
    // delegate to chat service for multi-paper search
    const data = await this.chatService.searchLibrary(user.id, term);
    return ApiResponseDto.success(data, 'Search results') as any;
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get detailed paper information',
    description: `Retrieve complete details for a specific paper.

**Includes:**
- Full metadata (title, authors, abstract, page count)
- Processing status and timestamps
- File information and storage details
- RAG processing statistics

**ID Parameter:** Can be either:
- Database paper ID (UUID)
- RAG file ID (for internal references)

**Use Case:** Display paper details in frontend before starting conversations`,
  })
  @ApiParam({ name: 'id', description: 'Paper ID or RAG file_id' })
  @ApiOkResponse({ type: GetPaperResponseDto })
  async get(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<GetPaperResponseDto> {
    const data = await this.paperService.getPaperById(user.id, id);
    return ApiResponseDto.success(data, 'Paper detail') as GetPaperResponseDto;
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete paper and all associated data',
    description: 'Permanently delete a paper and all related data.',
  })
  @ApiParam({ name: 'id', description: 'Paper ID' })
  @ApiOkResponse({ type: DeletePaperResponseDto })
  async delete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<DeletePaperResponseDto> {
    await this.paperService.deletePaper(user.id, id);
    return EmptyResponseDto.success(
      'Paper deleted successfully',
    ) as DeletePaperResponseDto;
  }

  @Delete()
  @ApiOperation({
    summary: 'Delete all papers owned by the user',
    description:
      'Permanently delete ALL papers belonging to the authenticated user.',
  })
  @ApiOkResponse({
    schema: {
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            deletedCount: { type: 'number' },
            skippedIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  })
  async deleteAll(@CurrentUser() user: CurrentUserPayload) {
    const result = await this.paperService.deleteAllPapers(user.id);
    return ApiResponseDto.success(
      result,
      result.deletedCount > 0
        ? `Deleted ${result.deletedCount} paper(s) successfully`
        : 'No papers to delete',
    );
  }

  // ============================================================
  // Summary, Related Papers, Brainstorm Questions
  // ============================================================

  @Post(':id/summary')
  @ApiOperation({
    summary: 'Generate or get paper summary',
    description: 'Generate a comprehensive LLM-powered summary of the paper.',
  })
  @ApiParam({ name: 'id', description: 'Paper ID' })
  @ApiOkResponse({ type: PaperSummaryResponseDto })
  async getSummary(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<PaperSummaryResponseDto> {
    const data = await this.paperService.getSummary(user.id, id);
    return ApiResponseDto.success(
      data,
      'Paper summary generated',
    ) as PaperSummaryResponseDto;
  }

  @Post(':id/related-papers')
  @ApiOperation({
    summary: 'Get related papers from arXiv',
    description:
      'Find related research papers on arXiv using LLM-powered search and re-ranking.',
  })
  @ApiParam({ name: 'id', description: 'Paper ID' })
  @ApiOkResponse({ type: RelatedPapersResponseDto })
  async getRelatedPapers(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: GetRelatedPapersRequestDto,
  ): Promise<RelatedPapersResponseDto> {
    const data = await this.paperService.getRelatedPapers(
      user.id,
      id,
      dto.topK ?? 5,
      dto.maxResults ?? 30,
    );
    return ApiResponseDto.success(
      data,
      'Related papers retrieved',
    ) as RelatedPapersResponseDto;
  }
}
