// src/highlight/comment.controller.ts
import {
  Controller,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiOkResponse,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommentService } from './comment.service';
import {
  UpdateCommentDto,
  CommentResponseDto,
  DeleteCommentResponseDto,
} from './dto/comment.dto';
import { ApiResponseDto } from '../common/dto/api-response.dto';

/**
 * Standalone controller for comment update/delete operations
 * Create and list operations are handled by HighlightController (nested routes)
 */
@ApiTags('comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Patch(':id')
  @ApiOperation({ summary: 'Update a comment' })
  @ApiParam({ name: 'id', description: 'Comment ID' })
  @ApiOkResponse({ type: CommentResponseDto })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async updateComment(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
    @Request() req: any,
  ): Promise<CommentResponseDto> {
    const data = await this.commentService.update(req.user.id, id, dto);
    return ApiResponseDto.success(
      data,
      'Comment updated',
    ) as CommentResponseDto;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiParam({ name: 'id', description: 'Comment ID' })
  @ApiOkResponse({ type: DeleteCommentResponseDto })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async deleteComment(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<DeleteCommentResponseDto> {
    const data = await this.commentService.delete(req.user.id, id);
    return ApiResponseDto.success(
      data,
      'Comment deleted',
    ) as DeleteCommentResponseDto;
  }
}
