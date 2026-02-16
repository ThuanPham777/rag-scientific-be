// src/chat/dto/toggle-reaction-request.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ToggleReactionRequestDto {
  @ApiProperty({
    description: 'Message ID to react to',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsUUID()
  messageId: string;

  @ApiProperty({
    description: 'Emoji reaction (e.g. 👍, ❤️, 😂)',
    example: '👍',
    minLength: 1,
    maxLength: 20,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  emoji: string;
}
