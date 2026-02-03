// src/chat/dto/ask-question-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * Citation DTO for chat responses
 */
export class ChatCitationDto {
  @ApiPropertyOptional({ description: 'Page number in PDF', example: 5 })
  pageNumber?: number;

  @ApiPropertyOptional({
    description: 'Text snippet from source',
    example: 'The model achieves 95% accuracy...',
  })
  snippet?: string;

  @ApiPropertyOptional({ description: 'Element ID', example: 'elem-123' })
  elementId?: string;

  @ApiPropertyOptional({ description: 'Chunk ID', example: 'chunk-456' })
  chunkId?: string;

  @ApiPropertyOptional({ description: 'Relevance score', example: 0.95 })
  score?: number;

  @ApiPropertyOptional({
    description: 'Source ID (e.g., S1, S2)',
    example: 'S1',
  })
  sourceId?: string;

  @ApiPropertyOptional({ description: 'Section title', example: 'Methodology' })
  sectionTitle?: string;

  @ApiPropertyOptional({ description: 'Bounding box coordinates' })
  bbox?: any;

  @ApiPropertyOptional({ description: 'Layout width', example: 612 })
  layoutWidth?: number;

  @ApiPropertyOptional({ description: 'Layout height', example: 792 })
  layoutHeight?: number;

  @ApiPropertyOptional({
    description: 'Source paper ID (for multi-paper chat)',
    example: 'uuid-here',
  })
  sourcePaperId?: string;

  @ApiPropertyOptional({
    description: 'Source paper title (for multi-paper chat)',
    example: 'Deep Learning for NLP',
  })
  sourcePaperTitle?: string;

  @ApiPropertyOptional({
    description: 'Source file URL (for multi-paper chat navigation)',
    example: 'https://bucket.s3.amazonaws.com/paper.pdf',
  })
  sourceFileUrl?: string;
}

/**
 * Ask question result DTO
 */
export class AskQuestionResultDto {
  @ApiProperty({
    description: 'AI-generated answer',
    example: 'Based on the paper, the model achieves...',
  })
  answer: string;

  @ApiProperty({ type: [ChatCitationDto], description: 'Source citations' })
  citations: ChatCitationDto[];

  @ApiProperty({ description: 'Assistant message ID', example: 'uuid-here' })
  assistantMessageId: string;

  @ApiProperty({ description: 'User message ID', example: 'uuid-here' })
  userMessageId: string;

  @ApiPropertyOptional({
    description: 'Conversation ID (returned when new conversation created)',
    example: 'uuid-here',
  })
  conversationId?: string;

  @ApiPropertyOptional({
    description: 'Model name used for generation',
    example: 'gpt-4',
  })
  modelName?: string;

  @ApiPropertyOptional({
    description: 'Token count for the response',
    example: 1500,
  })
  tokenCount?: number;
}

/**
 * Ask question response DTO
 */
export class AskQuestionResponseDto extends ApiResponseDto<AskQuestionResultDto> {
  @ApiProperty({ type: AskQuestionResultDto })
  declare data: AskQuestionResultDto;
}
