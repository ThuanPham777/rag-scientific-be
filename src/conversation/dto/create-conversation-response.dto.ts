// src/conversation/dto/create-conversation-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * Conversation item DTO
 */
export class ConversationItemDto {
  @ApiProperty({ description: 'Conversation ID', example: 'uuid-here' })
  id: string;

  @ApiProperty({ description: 'Associated paper ID', example: 'uuid-here' })
  paperId: string;

  @ApiProperty({ description: 'User ID', example: 'uuid-here' })
  userId: string;

  @ApiPropertyOptional({
    description: 'Conversation title',
    example: 'Discussion about methodology',
  })
  title?: string;

  @ApiProperty({
    description: 'Type of conversation',
    enum: ['SINGLE_PAPER', 'MULTI_PAPER'],
    example: 'SINGLE_PAPER',
  })
  type?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Paper title',
    example: 'Deep Learning for NLP',
  })
  paperTitle?: string;

  @ApiPropertyOptional({
    description: 'RAG file_id for the paper',
    example: 'uuid-here',
  })
  ragFileId?: string;
}

/**
 * Create conversation response DTO
 */
export class CreateConversationResponseDto extends ApiResponseDto<ConversationItemDto> {
  @ApiProperty({ type: ConversationItemDto })
  declare data: ConversationItemDto;
}
