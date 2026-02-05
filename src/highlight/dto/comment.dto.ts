// src/highlight/dto/comment.dto.ts
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * Create comment request DTO
 */
export class CreateCommentDto {
  @ApiProperty({
    description: 'Comment content/text',
    example: 'This is an important finding that relates to our research!',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}

/**
 * Update comment request DTO
 */
export class UpdateCommentDto {
  @ApiProperty({
    description: 'Updated comment content',
    example: 'Updated: This is even more important than I thought!',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}

/**
 * Comment item DTO
 */
export class CommentItemDto {
  @ApiProperty({
    description: 'Comment ID (UUID)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Highlight ID this comment belongs to',
    example: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    format: 'uuid',
  })
  highlightId: string;

  @ApiProperty({
    description: 'User ID who created this comment',
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789abc',
    format: 'uuid',
  })
  userId: string;

  @ApiProperty({
    description: 'Comment content',
    example: 'This is an important finding!',
  })
  content: string;

  @ApiProperty({
    description: 'When the comment was created',
    example: '2024-01-15T10:30:00.000Z',
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When the comment was last updated',
    example: '2024-01-20T15:45:00.000Z',
    format: 'date-time',
  })
  updatedAt: Date;
}

/**
 * List comments response DTO
 */
export class ListCommentsResponseDto extends ApiResponseDto<CommentItemDto[]> {
  @ApiProperty({
    type: [CommentItemDto],
    description: 'List of comments for the highlight',
  })
  declare data: CommentItemDto[];
}

/**
 * Single comment response DTO
 */
export class CommentResponseDto extends ApiResponseDto<CommentItemDto> {
  @ApiProperty({
    type: CommentItemDto,
    description: 'Comment data',
  })
  declare data: CommentItemDto;
}

/**
 * Delete comment result DTO
 */
export class DeleteCommentResultDto {
  @ApiProperty({
    description: 'Result message',
    example: 'Comment deleted successfully',
  })
  message: string;
}

/**
 * Delete comment response DTO
 */
export class DeleteCommentResponseDto extends ApiResponseDto<DeleteCommentResultDto> {
  @ApiProperty({ type: DeleteCommentResultDto })
  declare data: DeleteCommentResultDto;
}
