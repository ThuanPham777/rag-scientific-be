import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsUUID } from 'class-validator';

export enum ChatMode {
  novice = 'novice',
  researcher = 'researcher',
  reviewer = 'reviewer',
}

export class AskQuestionRequestDto {
  @ApiProperty()
  @IsUUID()
  paperId: string;

  @ApiProperty()
  @IsUUID()
  conversationId: string;

  @ApiProperty()
  @IsString()
  question: string;

  @ApiProperty({ enum: ChatMode })
  @IsEnum(ChatMode)
  mode: ChatMode;
}
