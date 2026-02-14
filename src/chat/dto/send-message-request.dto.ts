import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength, MaxLength } from 'class-validator';

/**
 * Send message request DTO (no AI response)
 *
 * @description Request để gửi tin nhắn bình thường trong collaborative session.
 * Không trigger RAG/AI. Tin nhắn chỉ được lưu và broadcast qua WebSocket.
 */
export class SendMessageRequestDto {
  @ApiProperty({
    description: 'Conversation ID (phải là collaborative session)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsUUID()
  conversationId: string;

  @ApiProperty({
    description: 'Nội dung tin nhắn',
    example: 'Hello everyone!',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}
