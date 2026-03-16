// src/session/dto/join-session.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class JoinSessionDto {
  @ApiProperty({ description: 'Invite token from the invite link' })
  @IsString()
  inviteToken: string;
}

export class PaperInfoDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() fileName: string;
  @ApiProperty() fileUrl: string;
  @ApiPropertyOptional() ragFileId?: string;
}

export class JoinSessionResultDto {
  @ApiProperty() conversationId: string;
  @ApiProperty() sessionCode: string;
  @ApiProperty() role: string;
  @ApiProperty() paperId: string;
  @ApiProperty() paperTitle: string;
  @ApiProperty() paperFileName: string;
  @ApiProperty() paperUrl: string;
  @ApiProperty() paperRagFileId: string;
  @ApiProperty() members: SessionMemberDto[];
  @ApiPropertyOptional({ type: [PaperInfoDto] }) papers?: PaperInfoDto[];
}

export class SessionMemberDto {
  @ApiProperty() userId: string;
  @ApiProperty() displayName: string;
  @ApiProperty({ nullable: true }) avatarUrl: string | null;
  @ApiProperty() role: string;
  @ApiProperty() joinedAt: Date;
  @ApiProperty() isActive: boolean;
}
