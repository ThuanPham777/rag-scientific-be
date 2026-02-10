// src/conversation/dto/suggested-questions.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

// ── Request ──────────────────────────────────────────────
export class GenerateSuggestedQuestionsRequestDto {
  @ApiPropertyOptional({
    description:
      'Optional text input from user to guide question generation. Questions will be tailored to this topic/interest.',
    example: 'How does the attention mechanism work?',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  textInput?: string;
}

// ── Response ─────────────────────────────────────────────
export class SuggestedQuestionItemDto {
  @ApiProperty({ description: 'Question ID' })
  id: string;

  @ApiProperty({ description: 'The question text' })
  question: string;
}

export class SuggestedQuestionsResultDto {
  @ApiProperty({ description: 'Conversation ID' })
  conversationId: string;

  @ApiProperty({
    description: 'Generated questions',
    type: [SuggestedQuestionItemDto],
  })
  questions: SuggestedQuestionItemDto[];
}

export class SuggestedQuestionsResponseDto extends ApiResponseDto<SuggestedQuestionsResultDto> {
  @ApiProperty({ type: SuggestedQuestionsResultDto })
  declare data: SuggestedQuestionsResultDto;
}

/** Alias – GET endpoint also returns the full result wrapper */
export class SuggestedQuestionsListResponseDto extends ApiResponseDto<SuggestedQuestionsResultDto> {
  @ApiProperty({ type: SuggestedQuestionsResultDto })
  declare data: SuggestedQuestionsResultDto;
}
