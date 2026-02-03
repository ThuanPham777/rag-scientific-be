// src/conversation/dto/get-conversation-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { ConversationItemDto } from './create-conversation-response.dto';

/**
 * Paper details in conversation
 */
export class ConversationPaperDto {
  @ApiProperty({ description: 'Paper ID', example: 'uuid-here' })
  id: string;

  @ApiProperty({ description: 'RAG file ID', example: 'uuid-here' })
  ragFileId: string;

  @ApiPropertyOptional({
    description: 'Paper title',
    example: 'Deep Learning for NLP',
  })
  title?: string;

  @ApiPropertyOptional({ description: 'File name', example: 'paper.pdf' })
  fileName?: string;

  @ApiPropertyOptional({ description: 'File URL' })
  fileUrl?: string;

  @ApiProperty({ description: 'Order index in conversation', example: 0 })
  orderIndex: number;
}

/**
 * Message item in conversation
 */
export class ConversationMessageDto {
  @ApiProperty({ description: 'Message ID', example: 'uuid-here' })
  id: string;

  @ApiProperty({
    description: 'Role',
    enum: ['user', 'assistant'],
    example: 'user',
  })
  role: string;

  @ApiProperty({
    description: 'Message content',
    example: 'What is the main finding?',
  })
  content: string;

  @ApiPropertyOptional({ description: 'Image URL for vision queries' })
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Context or citations' })
  context?: any;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;
}

/**
 * Full conversation details with messages
 */
export class ConversationDetailDto extends ConversationItemDto {
  @ApiPropertyOptional({ description: 'Paper URL' })
  paperUrl?: string;

  @ApiProperty({
    type: [ConversationPaperDto],
    description: 'Papers in conversation',
  })
  papers: ConversationPaperDto[];

  @ApiProperty({
    type: [ConversationMessageDto],
    description: 'Messages in conversation',
  })
  messages: ConversationMessageDto[];
}

/**
 * Get conversation response DTO
 */
export class GetConversationResponseDto extends ApiResponseDto<ConversationDetailDto> {
  @ApiProperty({ type: ConversationDetailDto })
  declare data: ConversationDetailDto;
}
