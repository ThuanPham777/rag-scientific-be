// src/highlight/highlight.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HighlightService } from './highlight.service';
import { CommentService } from './comment.service';
import { CreateHighlightDto } from './dto/create-highlight.dto';
import { UpdateHighlightDto } from './dto/update-highlight.dto';
import { CreateCommentDto } from './dto/comment.dto';
import {
  ListHighlightsResponseDto,
  GetHighlightResponseDto,
  HighlightResponseDto,
  DeleteHighlightResponseDto,
} from './dto/highlight-response.dto';
import { ListCommentsResponseDto, CommentResponseDto } from './dto/comment.dto';
import { ApiResponseDto } from '../common/dto/api-response.dto';

@ApiTags('highlights')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller()
export class HighlightController {
  constructor(
    private readonly highlightService: HighlightService,
    private readonly commentService: CommentService,
  ) {}

  // =========================================================================
  // HIGHLIGHT ENDPOINTS
  // =========================================================================

  @Post('papers/:paperId/highlights')
  @ApiOperation({ summary: 'Create a highlight on a paper' })
  @ApiParam({ name: 'paperId', description: 'Paper ID' })
  @ApiCreatedResponse({ type: HighlightResponseDto })
  @ApiResponse({ status: 404, description: 'Paper not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async createHighlight(
    @Param('paperId') paperId: string,
    @Body() dto: CreateHighlightDto,
    @Request() req: any,
  ): Promise<HighlightResponseDto> {
    const data = await this.highlightService.create(req.user.id, paperId, dto);
    return ApiResponseDto.success(
      data,
      'Highlight created',
    ) as HighlightResponseDto;
  }

  @Get('papers/:paperId/highlights')
  @ApiOperation({ summary: 'Get all highlights for a paper' })
  @ApiParam({ name: 'paperId', description: 'Paper ID' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Filter by page number',
    type: Number,
  })
  @ApiOkResponse({ type: ListHighlightsResponseDto })
  @ApiResponse({ status: 404, description: 'Paper not found' })
  async getHighlightsByPaper(
    @Param('paperId') paperId: string,
    @Query('page') page: string | undefined,
    @Request() req: any,
  ): Promise<ListHighlightsResponseDto> {
    const pageNumber = page ? parseInt(page, 10) : undefined;
    const data = await this.highlightService.findByPaper(
      req.user.id,
      paperId,
      pageNumber,
    );
    return ApiResponseDto.success(
      data,
      'Highlights retrieved',
    ) as ListHighlightsResponseDto;
  }

  @Get('highlights/:id')
  @ApiOperation({ summary: 'Get a highlight with its comments' })
  @ApiParam({ name: 'id', description: 'Highlight ID' })
  @ApiOkResponse({ type: GetHighlightResponseDto })
  @ApiResponse({ status: 404, description: 'Highlight not found' })
  async getHighlight(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<GetHighlightResponseDto> {
    const data = await this.highlightService.findOne(req.user.id, id);
    return ApiResponseDto.success(
      data,
      'Highlight retrieved',
    ) as GetHighlightResponseDto;
  }

  @Patch('highlights/:id')
  @ApiOperation({ summary: 'Update a highlight (color only)' })
  @ApiParam({ name: 'id', description: 'Highlight ID' })
  @ApiOkResponse({ type: HighlightResponseDto })
  @ApiResponse({ status: 404, description: 'Highlight not found' })
  async updateHighlight(
    @Param('id') id: string,
    @Body() dto: UpdateHighlightDto,
    @Request() req: any,
  ): Promise<HighlightResponseDto> {
    const data = await this.highlightService.update(req.user.id, id, dto);
    return ApiResponseDto.success(
      data,
      'Highlight updated',
    ) as HighlightResponseDto;
  }

  @Delete('highlights/:id')
  @ApiOperation({ summary: 'Delete a highlight and its comments' })
  @ApiParam({ name: 'id', description: 'Highlight ID' })
  @ApiOkResponse({ type: DeleteHighlightResponseDto })
  @ApiResponse({ status: 404, description: 'Highlight not found' })
  async deleteHighlight(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<DeleteHighlightResponseDto> {
    const data = await this.highlightService.delete(req.user.id, id);
    return ApiResponseDto.success(
      data,
      'Highlight deleted',
    ) as DeleteHighlightResponseDto;
  }

  // =========================================================================
  // COMMENT ENDPOINTS (nested under highlights)
  // =========================================================================

  @Post('highlights/:highlightId/comments')
  @ApiOperation({ summary: 'Add a comment to a highlight' })
  @ApiParam({ name: 'highlightId', description: 'Highlight ID' })
  @ApiCreatedResponse({ type: CommentResponseDto })
  @ApiResponse({ status: 404, description: 'Highlight not found' })
  async createComment(
    @Param('highlightId') highlightId: string,
    @Body() dto: CreateCommentDto,
    @Request() req: any,
  ): Promise<CommentResponseDto> {
    const data = await this.commentService.create(
      req.user.id,
      highlightId,
      dto,
    );
    return ApiResponseDto.success(data, 'Comment added') as CommentResponseDto;
  }

  @Get('highlights/:highlightId/comments')
  @ApiOperation({ summary: 'Get all comments for a highlight' })
  @ApiParam({ name: 'highlightId', description: 'Highlight ID' })
  @ApiOkResponse({ type: ListCommentsResponseDto })
  @ApiResponse({ status: 404, description: 'Highlight not found' })
  async getComments(
    @Param('highlightId') highlightId: string,
    @Request() req: any,
  ): Promise<ListCommentsResponseDto> {
    const data = await this.commentService.findByHighlight(
      req.user.id,
      highlightId,
    );
    return ApiResponseDto.success(
      data,
      'Comments retrieved',
    ) as ListCommentsResponseDto;
  }
}
