// src/chat/dto/get-messages-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatCitationDto } from './ask-question-response.dto';
import { ApiResponseDto, CursorPaginationDto } from 'src/common/dto';

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
    description: 'User ID who sent the message (collaborative sessions)',
    example: 'uuid-here',
  })
  userId?: string;

  @ApiPropertyOptional({
    description: 'Display name of the sender (collaborative sessions)',
    example: 'John Doe',
  })
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Avatar URL of the sender (collaborative sessions)',
    example: 'https://lh3.googleusercontent.com/a/photo.jpg',
  })
  avatarUrl?: string;

  @ApiPropertyOptional({
    type: [ChatCitationDto],
    description: 'Citations for assistant messages',
  })
  citations?: ChatCitationDto[];
}

export class GetMessagesResponseDto extends ApiResponseDto<
  CursorPaginationDto<MessageItemDto>
> {
  @ApiProperty({ type: CursorPaginationDto })
  declare data: CursorPaginationDto<MessageItemDto>;
}
