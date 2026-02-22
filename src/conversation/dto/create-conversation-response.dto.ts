// src/conversation/dto/create-conversation-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * Conversation item DTO
 *
 * @description Thông tin một phiên hội thoại (chat session) về paper.
 * User có thể có nhiều conversations cho cùng một paper.
 */
export class ConversationItemDto {
  @ApiProperty({
    description: 'Conversation ID (UUID)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'Paper ID chính của conversation này (null cho multi-paper)',
    example: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    format: 'uuid',
  })
  paperId?: string;

  @ApiProperty({
    description: 'ID của user sở hữu conversation',
    example: 'c3d4e5f6-a7b8-9012-cdef-345678901234',
    format: 'uuid',
  })
  userId: string;

  @ApiPropertyOptional({
    description:
      'Tiêu đề conversation - do user đặt hoặc auto-generate từ câu hỏi đầu',
    example: 'Discussion about attention mechanism',
    maxLength: 300,
  })
  title?: string;

  @ApiProperty({
    description: `Loại conversation:
- **SINGLE_PAPER**: Chat về 1 paper duy nhất
- **MULTI_PAPER**: Chat so sánh/tổng hợp nhiều papers
- **GROUP**: Collaborative group chat session`,
    enum: ['SINGLE_PAPER', 'MULTI_PAPER', 'GROUP'],
    example: 'SINGLE_PAPER',
    enumName: 'ConversationType',
  })
  type?: string;

  @ApiPropertyOptional({
    description: 'Whether this conversation is a collaborative session',
    example: false,
  })
  isCollaborative?: boolean;

  @ApiProperty({
    description: 'Thời điểm tạo conversation',
    example: '2024-01-15T10:30:00.000Z',
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Thời điểm có message cuối cùng (để sort recent)',
    example: '2024-01-15T14:22:00.000Z',
    format: 'date-time',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Tiêu đề paper chính - hiển thị context trong UI',
    example: 'Attention Is All You Need',
  })
  paperTitle?: string;

  @ApiPropertyOptional({
    description: 'RAG file_id của paper chính - dùng cho quick reference',
    example: '8fc4b997-0165-41c4-8e5c-f2effa478855',
    format: 'uuid',
  })
  ragFileId?: string;
}

/**
 * Create conversation response DTO
 *
 * @description Response sau khi tạo conversation mới.
 * Sử dụng conversation.id cho các API chat tiếp theo.
 */
export class CreateConversationResponseDto extends ApiResponseDto<ConversationItemDto> {
  @ApiProperty({
    type: ConversationItemDto,
    description: 'Conversation vừa tạo',
  })
  declare data: ConversationItemDto;
}
