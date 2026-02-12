// src/chat/dto/ask-multi-paper-request.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { ChatCitationDto } from './ask-question-response.dto';

/**
 * Request DTO for multi-paper chat
 */
export class AskMultiPaperRequestDto {
  @ApiProperty({
    description: 'List of paper IDs to query across',
    example: ['uuid-1', 'uuid-2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  paperIds: string[];

  @ApiProperty({
    description: 'User question',
    example: 'Compare the methodologies',
  })
  @IsString()
  question: string;

  @ApiPropertyOptional({
    description: 'Optional conversation ID for history tracking',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsUUID()
  conversationId?: string;
}

/**
 * Source paper DTO for multi-paper responses
 */
export class MultiPaperSourceDto {
  @ApiProperty({ description: 'Paper ID', example: 'uuid-here' })
  paperId: string;

  @ApiProperty({ description: 'Paper title', example: 'Deep Learning for NLP' })
  title: string;

  @ApiPropertyOptional({
    description: 'File URL',
    example: 'https://s3.example.com/paper.pdf',
  })
  fileUrl?: string | null;
}

/**
 * Result DTO for multi-paper chat
 */
export class AskMultiPaperResultDto {
  @ApiProperty({
    description: 'AI-generated answer',
    example: 'Comparing the papers...',
  })
  answer: string;

  @ApiProperty({
    type: [ChatCitationDto],
    description: 'Citations from papers',
  })
  citations: ChatCitationDto[];

  @ApiProperty({ type: [MultiPaperSourceDto], description: 'Source papers' })
  sources: MultiPaperSourceDto[];

  @ApiPropertyOptional({
    description: 'Assistant message ID',
    example: 'uuid-here',
  })
  assistantMessageId?: string;

  @ApiPropertyOptional({ description: 'User message ID', example: 'uuid-here' })
  userMessageId?: string;

  @ApiPropertyOptional({ description: 'Conversation ID', example: 'uuid-here' })
  conversationId?: string;

  @ApiPropertyOptional({ description: 'Model name', example: 'gpt-4' })
  modelName?: string;

  @ApiPropertyOptional({ description: 'Token count', example: 2000 })
  tokenCount?: number;
}

/**
 * Response DTO for multi-paper chat
 */
export class AskMultiPaperResponseDto extends ApiResponseDto<AskMultiPaperResultDto> {
  @ApiProperty({ type: AskMultiPaperResultDto })
  declare data: AskMultiPaperResultDto;
}
