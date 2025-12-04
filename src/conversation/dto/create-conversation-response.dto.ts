import { ApiProperty } from '@nestjs/swagger';
import { BaseResponseDto } from 'src/common/dto/base-response.dto';

export class ConversationItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  paperId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ required: false })
  title?: string;

  @ApiProperty()
  mode: string;

  @ApiProperty()
  createdAt: Date;
}

export class CreateConversationResponseDto extends BaseResponseDto<ConversationItemDto> {
  @ApiProperty({ type: ConversationItemDto })
  declare data: ConversationItemDto;
}
