// src/conversation/dto/conversation-history.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

export class ConversationHistoryMemberDto {
  @ApiProperty() userId: string;
  @ApiProperty() displayName: string;
  @ApiPropertyOptional() avatarUrl?: string;
  @ApiProperty() role: string;
}

export class ConversationHistoryPaperDto {
  @ApiProperty() id: string;
  @ApiProperty() fileName: string;
  @ApiPropertyOptional() title?: string;
}

export class ConversationHistoryItemDto {
  @ApiProperty() id: string;
  @ApiPropertyOptional() title?: string;
  @ApiProperty({ enum: ['SINGLE_PAPER', 'MULTI_PAPER', 'GROUP'] })
  type: string;

  @ApiProperty() isCollaborative: boolean;
  @ApiProperty() isClosed: boolean;

  @ApiProperty() startedAt: Date;
  @ApiProperty() lastInteractionAt: Date;
  @ApiProperty() messageCount: number;

  @ApiProperty({ type: [ConversationHistoryPaperDto] })
  papers: ConversationHistoryPaperDto[];

  @ApiPropertyOptional({ type: [ConversationHistoryMemberDto] })
  members?: ConversationHistoryMemberDto[];
}

export class ConversationHistoryResponseDto extends ApiResponseDto<
  ConversationHistoryItemDto[]
> {
  @ApiProperty({ type: [ConversationHistoryItemDto] })
  declare data: ConversationHistoryItemDto[];
}

export class UpdateConversationDto {
  @ApiPropertyOptional({ description: 'New title for the conversation' })
  title?: string;
}

export class CloseConversationResponseDto extends ApiResponseDto<null> {}
