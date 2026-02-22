// src/chat/dto/reply-message-request.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ReplyMessageRequestDto {
  @ApiProperty({
    description: 'Conversation ID',
    format: 'uuid',
  })
  @IsUUID()
  conversationId: string;

  @ApiProperty({
    description: 'ID of the message being replied to',
    format: 'uuid',
  })
  @IsUUID()
  replyToMessageId: string;

  @ApiProperty({
    description: 'Reply message content',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}
