import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseResponseDto } from 'src/common/dto/base-response.dto';

export class ChatCitationDto {
  @ApiPropertyOptional({ description: 'Page number in PDF' })
  pageNumber?: number;

  @ApiPropertyOptional({ description: 'Text snippet from source' })
  snippet?: string;

  @ApiPropertyOptional({ description: 'Element ID' })
  elementId?: string;

  @ApiPropertyOptional({ description: 'Chunk ID' })
  chunkId?: string;

  @ApiPropertyOptional({ description: 'Relevance score' })
  score?: number;

  @ApiPropertyOptional({ description: 'Source ID (e.g., S1, S2)' })
  sourceId?: string;

  @ApiPropertyOptional({ description: 'Section title' })
  sectionTitle?: string;

  @ApiPropertyOptional({ description: 'Bounding box coordinates' })
  bbox?: any;

  @ApiPropertyOptional({ description: 'Layout width' })
  layoutWidth?: number;

  @ApiPropertyOptional({ description: 'Layout height' })
  layoutHeight?: number;
}

export class AskQuestionResultDto {
  @ApiProperty({ description: 'AI-generated answer' })
  answer: string;

  @ApiProperty({ type: [ChatCitationDto], description: 'Source citations' })
  citations: ChatCitationDto[];

  @ApiProperty({ description: 'Assistant message ID' })
  assistantMessageId: string;

  @ApiProperty({ description: 'User message ID' })
  userMessageId: string;

  @ApiPropertyOptional({
    description: 'Conversation ID (returned when new conversation created)',
  })
  conversationId?: string;

  @ApiPropertyOptional({ description: 'Model name used for generation' })
  modelName?: string;

  @ApiPropertyOptional({ description: 'Token count for the response' })
  tokenCount?: number;
}

export class AskQuestionResponseDto extends BaseResponseDto<AskQuestionResultDto> {
  @ApiProperty({ type: AskQuestionResultDto })
  declare data: AskQuestionResultDto;
}
