// src/session/dto/create-session.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({
    description: 'Paper ID to create a collaborative session for',
  })
  @IsUUID()
  paperId: string;

  @ApiPropertyOptional({
    description:
      'Source conversation ID to clone messages from (single-paper chat)',
  })
  @IsOptional()
  @IsUUID()
  sourceConversationId?: string;

  @ApiPropertyOptional({
    description: 'Max members allowed (default 10)',
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(50)
  maxMembers?: number;
}

export class CreateSessionResultDto {
  @ApiProperty() conversationId: string;
  @ApiProperty() paperId: string;
  @ApiProperty() sessionCode: string;
  @ApiProperty() inviteLink: string;
  @ApiProperty() inviteToken: string;
  @ApiProperty() expiresAt: Date;
  @ApiProperty() maxMembers: number;
}
