// src/chat/dto/get-messages-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { ChatCitationDto } from './ask-question-response.dto';

/**
 * Message item in conversation history
 */
export class MessageItemDto {
  @ApiProperty({ description: 'Message ID', example: 'uuid-here' })
  id: string;

  @ApiProperty({
    description: 'Role',
    enum: ['USER', 'ASSISTANT'],
    example: 'USER',
  })
  role: string;

  @ApiProperty({
    description: 'Message content',
    example: 'What is the main finding of this paper?',
  })
  content: string;

  @ApiPropertyOptional({
    description: 'Image URL for vision queries',
    example: 'https://s3.example.com/image.png',
  })
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Model name used for generation',
    example: 'gpt-4',
  })
  modelName?: string;

  @ApiPropertyOptional({
    description: 'Token count',
    example: 150,
  })
  tokenCount?: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiPropertyOptional({
    type: [ChatCitationDto],
    description: 'Citations for assistant messages',
  })
  citations?: ChatCitationDto[];
}

/**
 * Get messages response DTO
 */
export class GetMessagesResponseDto extends ApiResponseDto<MessageItemDto[]> {
  @ApiProperty({ type: [MessageItemDto] })
  declare data: MessageItemDto[];
}
