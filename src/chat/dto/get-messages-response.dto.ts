// src/chat/dto/get-messages-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatCitationDto } from './ask-question-response.dto';
import { ApiResponseDto, CursorPaginationDto } from 'src/common/dto';

/**
 * Aggregated reaction for a message
 */
export class ReactedByDto {
  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'User display name' })
  displayName: string;
}

export class ReactionAggregateDto {
  @ApiProperty({ description: 'Emoji', example: '👍' })
  emoji: string;

  @ApiProperty({ description: 'Total count', example: 3 })
  count: number;

  @ApiProperty({
    description: 'Whether the current user has this reaction',
    example: true,
  })
  hasReacted: boolean;

  @ApiProperty({
    description: 'Users who reacted with this emoji',
    type: [ReactedByDto],
  })
  reactedBy: ReactedByDto[];

  @ApiProperty({
    description:
      'Timestamp when this emoji was first used (for chronological ordering)',
    example: '2024-01-15T10:30:00.000Z',
  })
  firstReactedAt: Date;
}

/**
 * Summary of the message being replied to
 */
export class ReplyToMessageDto {
  @ApiProperty({ description: 'Original message ID' })
  id: string;

  @ApiProperty({ description: 'Original message content (truncated)' })
  content: string;

  @ApiProperty({
    description: 'Original message role',
    enum: ['USER', 'ASSISTANT', 'SYSTEM'],
  })
  role: string;

  @ApiPropertyOptional({ description: 'Original sender display name' })
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Whether the original message was deleted',
  })
  isDeleted?: boolean;
}

/**
 * Message item in conversation history
 */
export class MessageItemDto {
  @ApiProperty({ description: 'Message ID', example: 'uuid-here' })
  id: string;

  @ApiProperty({
    description: 'Role',
    enum: ['USER', 'ASSISTANT', 'SYSTEM'],
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

  @ApiPropertyOptional({
    type: [ReactionAggregateDto],
    description: 'Aggregated reactions on this message',
  })
  reactions?: ReactionAggregateDto[];

  @ApiPropertyOptional({
    type: ReplyToMessageDto,
    description: 'The message being replied to (if this is a reply)',
  })
  replyTo?: ReplyToMessageDto;

  @ApiPropertyOptional({
    description: 'Whether the message has been soft-deleted',
  })
  isDeleted?: boolean;
}

export class GetMessagesResponseDto extends ApiResponseDto<
  CursorPaginationDto<MessageItemDto>
> {
  @ApiProperty({ type: CursorPaginationDto })
  declare data: CursorPaginationDto<MessageItemDto>;
}
