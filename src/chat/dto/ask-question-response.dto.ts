import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseResponseDto } from 'src/common/dto/base-response.dto';

export class ChatCitationDto {
  @ApiPropertyOptional()
  pageNumber?: number;

  @ApiPropertyOptional()
  snippet?: string;

  @ApiPropertyOptional()
  elementId?: string;

  @ApiPropertyOptional()
  chunkId?: string;

  @ApiPropertyOptional()
  score?: number;
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
