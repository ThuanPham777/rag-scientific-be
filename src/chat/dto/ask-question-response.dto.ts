import { ApiProperty } from '@nestjs/swagger';
import { BaseResponseDto } from 'src/common/dto/base-response.dto';

export class ChatCitationDto {
  @ApiProperty({ required: false })
  pageNumber?: number;

  @ApiProperty({ required: false })
  snippet?: string;

  @ApiProperty({ required: false })
  elementId?: string;

  @ApiProperty({ required: false })
  chunkId?: string;

  @ApiProperty({ required: false })
  score?: number;
}

export class AskQuestionResultDto {
  @ApiProperty()
  answer: string;

  @ApiProperty({ type: [ChatCitationDto] })
  citations: ChatCitationDto[];

  @ApiProperty()
  assistantMessageId: string;

  @ApiProperty()
  userMessageId: string;

  @ApiProperty()
  qaTurnId: string;
}

export class AskQuestionResponseDto extends BaseResponseDto<AskQuestionResultDto> {
  @ApiProperty({ type: AskQuestionResultDto })
  declare data: AskQuestionResultDto;
}
