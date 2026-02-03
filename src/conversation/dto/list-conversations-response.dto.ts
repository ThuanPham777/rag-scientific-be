// src/conversation/dto/list-conversations-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { ConversationItemDto } from './create-conversation-response.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * List conversations response DTO
 */
export class ListConversationsResponseDto extends ApiResponseDto<
  ConversationItemDto[]
> {
  @ApiProperty({
    type: [ConversationItemDto],
    description: 'List of conversations',
  })
  declare data: ConversationItemDto[];
}
