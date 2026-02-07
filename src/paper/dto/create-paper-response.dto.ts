// src/paper/dto/create-paper-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * Paper item DTO - represents a single paper
 *
 * @description Thông tin chi tiết của một paper đã upload.
 * Bao gồm metadata từ GROBID extraction và thống kê từ RAG ingest.
 */
export class PaperItemDto {
  @ApiProperty({
    description:
      'Paper ID (UUID) trong database NestJS - dùng cho các API endpoints',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description:
      '⚠️ CRITICAL: RAG file_id - dùng để query RAG_BE_02 service. Maps to file_id trong tất cả RAG API calls (/query, /brainstorm, /status)',
    example: '8fc4b997-0165-41c4-8e5c-f2effa478855',
    format: 'uuid',
  })
  ragFileId: string;

  @ApiProperty({
    description: 'Tên file gốc khi upload - hiển thị trong UI',
    example: 'attention_is_all_you_need.pdf',
  })
  fileName: string;

  @ApiProperty({
    description: 'URL đến file PDF trên S3/Cloud storage - dùng cho PDF viewer',
    example:
      'https://rag-scientific.s3.ap-southeast-1.amazonaws.com/papers/uuid/attention.pdf',
    format: 'uri',
  })
  fileUrl: string;

  @ApiPropertyOptional({
    description: 'Kích thước file PDF (bytes) - hiển thị cho user',
    example: 2458624,
    minimum: 0,
  })
  fileSize?: number;

  @ApiPropertyOptional({
    description:
      'Tiêu đề paper - extracted bởi GROBID khi ingest. Có thể null nếu extraction failed.',
    example: 'Attention Is All You Need',
    maxLength: 500,
  })
  title?: string;

  @ApiPropertyOptional({
    description:
      'Abstract/tóm tắt paper - extracted bởi GROBID. Dùng cho preview và search.',
    example:
      'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...',
  })
  abstract?: string;

  @ApiPropertyOptional({
    description:
      'Danh sách tác giả - extracted bởi GROBID. Stored as JSON array string.',
    example: '["Ashish Vaswani", "Noam Shazeer", "Niki Parmar"]',
  })
  authors?: string;

  @ApiPropertyOptional({
    description: 'Tổng số trang của PDF',
    example: 15,
    minimum: 1,
  })
  numPages?: number;

  @ApiProperty({
    description: `Trạng thái xử lý paper trong RAG pipeline:
- **PENDING**: Vừa upload, chờ ingest
- **PROCESSING**: Đang được GROBID parse và embedding
- **COMPLETED**: Sẵn sàng cho Q&A
- **FAILED**: Xử lý thất bại (xem errorMessage)`,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
    example: 'COMPLETED',
    enumName: 'PaperStatus',
  })
  status: string;

  @ApiPropertyOptional({
    description: 'Số text nodes sau khi chunk - ảnh hưởng chất lượng retrieval',
    example: 247,
    minimum: 0,
  })
  nodeCount?: number;

  @ApiPropertyOptional({
    description: 'Số bảng được extract - có thể query riêng trong RAG',
    example: 12,
    minimum: 0,
  })
  tableCount?: number;

  @ApiPropertyOptional({
    description: 'Số hình/figure được extract - hỗ trợ visual Q&A',
    example: 8,
    minimum: 0,
  })
  imageCount?: number;

  @ApiProperty({
    description: 'Thời điểm upload paper',
    example: '2024-01-15T10:30:00.000Z',
    format: 'date-time',
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Thời điểm hoàn thành ingest - null nếu chưa COMPLETED',
    example: '2024-01-15T10:32:15.000Z',
    format: 'date-time',
  })
  processedAt?: Date;
}

/**
 * Create paper response DTO
 *
 * @description Response khi tạo paper mới. Paper sẽ ở trạng thái PENDING/PROCESSING.
 * Frontend cần poll `/papers/{id}` để check khi nào status = COMPLETED.
 */
export class CreatePaperResponseDto extends ApiResponseDto<PaperItemDto> {
  @ApiProperty({ type: PaperItemDto, description: 'Thông tin paper vừa tạo' })
  declare data: PaperItemDto;
}
