// src/chat/dto/delete-message-request.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class DeleteMessageRequestDto {
  @ApiProperty({
    description: 'Conversation ID the message belongs to',
    format: 'uuid',
  })
  @IsUUID()
  conversationId: string;

  @ApiProperty({
    description: 'Message ID to delete',
    format: 'uuid',
  })
  @IsUUID()
  messageId: string;
}
