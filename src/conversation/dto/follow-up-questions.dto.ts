// src/conversation/dto/follow-up-questions.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

// ── Response ─────────────────────────────────────────────

/**
 * Follow-up questions are ephemeral (not stored in DB).
 * They are generated on-the-fly by the RAG service.
 */
export class FollowUpQuestionsResultDto {
  @ApiProperty({ description: 'Message ID the follow-ups relate to' })
  messageId: string;

  @ApiProperty({
    description: 'Generated follow-up question strings',
    type: [String],
    example: [
      'How does the attention mechanism compare to RNN-based approaches?',
      'What are the computational trade-offs of this method?',
    ],
  })
  questions: string[];
}

export class FollowUpQuestionsResponseDto extends ApiResponseDto<FollowUpQuestionsResultDto> {
  @ApiProperty({ type: FollowUpQuestionsResultDto })
  declare data: FollowUpQuestionsResultDto;
}
