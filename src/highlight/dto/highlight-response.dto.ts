// src/highlight/dto/highlight-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HighlightColor } from '@prisma/client';
import {
  ApiResponseDto,
  EmptyResponseDto,
} from '../../common/dto/api-response.dto';
import { SelectionRectDto } from './create-highlight.dto';
import { CommentItemDto } from './comment.dto';

/**
 * Comment count DTO
 */
export class CommentCountDto {
  @ApiProperty({
    description: 'Number of comments on this highlight',
    example: 3,
    minimum: 0,
  })
  comments: number;
}

/**
 * Highlight item DTO
 * Basic highlight information without nested comments
 */
export class HighlightItemDto {
  @ApiProperty({
    description: 'Highlight ID (UUID)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Paper ID this highlight belongs to',
    example: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    format: 'uuid',
  })
  paperId: string;

  @ApiProperty({
    description: 'User ID who created this highlight',
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789abc',
    format: 'uuid',
  })
  userId: string;

  @ApiProperty({
    description: 'Page number where highlight is located (1-indexed)',
    example: 5,
    minimum: 1,
  })
  pageNumber: number;

  @ApiProperty({
    type: [SelectionRectDto],
    description: 'Bounding boxes of the text selection',
  })
  selectionRects: SelectionRectDto[];

  @ApiProperty({
    description: 'The highlighted text content',
    example: 'Neural networks have shown remarkable performance...',
  })
  selectedText: string;

  @ApiPropertyOptional({
    description: 'Text before the selection (for fallback anchoring)',
    example: 'Recent studies on ',
  })
  textPrefix?: string;

  @ApiPropertyOptional({
    description: 'Text after the selection (for fallback anchoring)',
    example: ' in various domains.',
  })
  textSuffix?: string;

  @ApiProperty({
    enum: HighlightColor,
    description: 'Highlight color',
    example: 'YELLOW',
  })
  color: HighlightColor;

  @ApiProperty({
    description: 'When the highlight was created',
    example: '2024-01-15T10:30:00.000Z',
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When the highlight was last updated',
    example: '2024-01-20T15:45:00.000Z',
    format: 'date-time',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    type: CommentCountDto,
    description: 'Comment count from Prisma _count',
  })
  _count?: CommentCountDto;
}

/**
 * Highlight with comments DTO
 * Full highlight data including nested comments
 */
export class HighlightWithCommentsDto extends HighlightItemDto {
  @ApiProperty({
    type: [CommentItemDto],
    description: 'Comments on this highlight, ordered by creation date',
  })
  comments: CommentItemDto[];
}

/**
 * List highlights response DTO
 */
export class ListHighlightsResponseDto extends ApiResponseDto<
  HighlightItemDto[]
> {
  @ApiProperty({
    type: [HighlightItemDto],
    description: 'List of highlights for the paper/page',
  })
  declare data: HighlightItemDto[];
}

/**
 * Get highlight response DTO
 */
export class GetHighlightResponseDto extends ApiResponseDto<HighlightWithCommentsDto> {
  @ApiProperty({
    type: HighlightWithCommentsDto,
    description: 'Highlight with comments',
  })
  declare data: HighlightWithCommentsDto;
}

/**
 * Create/Update highlight response DTO
 */
export class HighlightResponseDto extends ApiResponseDto<HighlightItemDto> {
  @ApiProperty({
    type: HighlightItemDto,
    description: 'Created or updated highlight',
  })
  declare data: HighlightItemDto;
}

/**
 * Delete highlight result DTO
 */
export class DeleteHighlightResultDto {
  @ApiProperty({
    description: 'Result message',
    example: 'Highlight deleted successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Number of comments that were also deleted',
    example: 2,
  })
  deletedComments: number;
}

/**
 * Delete highlight response DTO
 */
export class DeleteHighlightResponseDto extends ApiResponseDto<DeleteHighlightResultDto> {
  @ApiProperty({ type: DeleteHighlightResultDto })
  declare data: DeleteHighlightResultDto;
}
