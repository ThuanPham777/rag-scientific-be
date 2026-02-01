import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseResponseDto } from 'src/common/dto/base-response.dto';

export class ConversationItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  paperId: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Paper title' })
  paperTitle?: string;

  @ApiPropertyOptional({ description: 'RAG file_id for the paper' })
  ragFileId?: string;
}

export class CreateConversationResponseDto extends BaseResponseDto<ConversationItemDto> {
  @ApiProperty({ type: ConversationItemDto })
  declare data: ConversationItemDto;
}
