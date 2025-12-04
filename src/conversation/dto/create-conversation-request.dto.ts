import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export enum ConversationMode {
  novice = 'novice',
  researcher = 'researcher',
  reviewer = 'reviewer',
}

export class CreateConversationRequestDto {
  @ApiProperty()
  @IsUUID()
  paperId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ enum: ConversationMode, required: false })
  @IsOptional()
  @IsEnum(ConversationMode)
  mode?: ConversationMode;
}
