// src/session/dto/session-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { SessionMemberDto } from './join-session.dto';

export class SessionDetailDto {
  @ApiProperty() conversationId: string;
  @ApiProperty() sessionCode: string;
  @ApiProperty() isCollaborative: boolean;
  @ApiProperty() maxMembers: number;
  @ApiProperty() memberCount: number;
  @ApiProperty() members: SessionMemberDto[];
  @ApiPropertyOptional() paperId?: string;
  @ApiPropertyOptional() paperTitle?: string;
  @ApiPropertyOptional() paperFileName?: string;
  @ApiPropertyOptional() paperUrl?: string;
  @ApiProperty() createdAt: Date;
}

export class CreateInviteResultDto {
  @ApiProperty() inviteToken: string;
  @ApiProperty() inviteLink: string;
  @ApiProperty() expiresAt: Date;
  @ApiProperty() maxUses: number;
}

export class RemoveMemberResultDto {
  @ApiProperty() removed: boolean;
  @ApiProperty() userId: string;
}

// Wrapped API responses
export class CreateSessionResponseDto extends ApiResponseDto<any> {}
export class JoinSessionResponseDto extends ApiResponseDto<any> {}
export class SessionDetailResponseDto extends ApiResponseDto<SessionDetailDto> {}
export class CreateInviteResponseDto extends ApiResponseDto<CreateInviteResultDto> {}
export class ListSessionsResponseDto extends ApiResponseDto<
  SessionDetailDto[]
> {}
export class RemoveMemberResponseDto extends ApiResponseDto<RemoveMemberResultDto> {}
export class LeaveSessionResponseDto extends ApiResponseDto<any> {}
