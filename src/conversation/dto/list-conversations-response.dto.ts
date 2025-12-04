import { ApiProperty } from '@nestjs/swagger';
import { ConversationItemDto } from './create-conversation-response.dto';

export class ListConversationsResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: [ConversationItemDto] })
  data: ConversationItemDto[];
}
