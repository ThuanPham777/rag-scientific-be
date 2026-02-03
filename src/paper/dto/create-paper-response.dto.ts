// src/paper/dto/create-paper-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * Paper item DTO - represents a single paper
 */
export class PaperItemDto {
  @ApiProperty({ description: 'Paper ID', example: 'uuid-here' })
  id: string;

  @ApiProperty({
    description: 'RAG file_id for querying',
    example: 'uuid-here',
  })
  ragFileId: string;

  @ApiProperty({ description: 'Original filename', example: 'paper.pdf' })
  fileName: string;

  @ApiProperty({
    description: 'File URL (S3/Cloud)',
    example: 'https://bucket.s3.amazonaws.com/paper.pdf',
  })
  fileUrl: string;

  @ApiPropertyOptional({ description: 'File size in bytes', example: 1024000 })
  fileSize?: number;

  @ApiPropertyOptional({
    description: 'Extracted paper title',
    example: 'Deep Learning for NLP',
  })
  title?: string;

  @ApiPropertyOptional({
    description: 'Extracted paper abstract',
    example: 'This paper presents...',
  })
  abstract?: string;

  @ApiProperty({
    description: 'Processing status',
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
    example: 'COMPLETED',
  })
  status: string;

  @ApiPropertyOptional({ description: 'Number of text nodes', example: 150 })
  nodeCount?: number;

  @ApiPropertyOptional({ description: 'Number of tables', example: 5 })
  tableCount?: number;

  @ApiPropertyOptional({ description: 'Number of images', example: 10 })
  imageCount?: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Processing completion timestamp' })
  processedAt?: Date;
}

/**
 * Create paper response DTO
 */
export class CreatePaperResponseDto extends ApiResponseDto<PaperItemDto> {
  @ApiProperty({ type: PaperItemDto })
  declare data: PaperItemDto;
}
