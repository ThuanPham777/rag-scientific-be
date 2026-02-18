// src/session/session.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { SessionService } from './session.service';
import { SessionGateway } from './session.gateway';
import { CreateSessionDto } from './dto/create-session.dto';
import { JoinSessionDto } from './dto/join-session.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import {
  CreateSessionResponseDto,
  JoinSessionResponseDto,
  SessionDetailResponseDto,
  CreateInviteResponseDto,
  ListSessionsResponseDto,
  RemoveMemberResponseDto,
  LeaveSessionResponseDto,
} from './dto/session-response.dto';

@ApiTags('Sessions (Collaborative)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly sessionGateway: SessionGateway,
  ) {}

  // =========================================================================
  // SESSION LIFECYCLE
  // =========================================================================

  @Post()
  @ApiOperation({
    summary: 'Start a collaborative session',
    description:
      'Convert an existing conversation into a collaborative session. Only the conversation owner can do this.',
  })
  @ApiCreatedResponse({ type: CreateSessionResponseDto })
  async createSession(
    @CurrentUser() user: any,
    @Body() dto: CreateSessionDto,
  ): Promise<CreateSessionResponseDto> {
    const data = await this.sessionService.createSession(user.id, dto);
    return ApiResponseDto.success(
      data,
      'Collaborative session created',
    ) as CreateSessionResponseDto;
  }

  @Post('join')
  @ApiOperation({
    summary: 'Join a collaborative session',
    description: 'Join a session using an invite token.',
  })
  @ApiOkResponse({ type: JoinSessionResponseDto })
  async joinSession(
    @CurrentUser() user: any,
    @Body() dto: JoinSessionDto,
  ): Promise<JoinSessionResponseDto> {
    const data = await this.sessionService.joinSession(
      user.id,
      dto.inviteToken,
    );

    // Create & broadcast system message
    const displayName = await this.sessionService.getUserDisplayName(user.id);
    const sysMsg = await this.sessionService.createSystemMessage(
      data.conversationId,
      `${displayName} joined the session`,
    );
    this.sessionGateway.broadcastMessage(data.conversationId, {
      id: sysMsg.id,
      role: 'SYSTEM',
      content: sysMsg.content,
      createdAt: sysMsg.createdAt,
    });

    return ApiResponseDto.success(
      data,
      'Joined session successfully',
    ) as JoinSessionResponseDto;
  }

  @Post(':conversationId/leave')
  @ApiOperation({ summary: 'Leave a collaborative session' })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  @ApiOkResponse({ type: LeaveSessionResponseDto })
  async leaveSession(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
  ): Promise<LeaveSessionResponseDto> {
    // Fetch display name before leaving
    const displayName = await this.sessionService.getUserDisplayName(user.id);

    await this.sessionService.leaveSession(user.id, conversationId);

    // Create & broadcast system message
    const sysMsg = await this.sessionService.createSystemMessage(
      conversationId,
      `${displayName} left the session`,
    );
    this.sessionGateway.broadcastMessage(conversationId, {
      id: sysMsg.id,
      role: 'SYSTEM',
      content: sysMsg.content,
      createdAt: sysMsg.createdAt,
    });

    return ApiResponseDto.success(
      null,
      'Left session successfully',
    ) as LeaveSessionResponseDto;
  }

  @Delete(':conversationId')
  @ApiOperation({
    summary: 'End a collaborative session (owner only)',
    description:
      'Ends the session, deactivates all members, revokes all invites.',
  })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  @ApiOkResponse({ type: LeaveSessionResponseDto })
  async endSession(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
  ): Promise<LeaveSessionResponseDto> {
    await this.sessionService.endSession(user.id, conversationId);

    // Create & broadcast system message, then notify via dedicated event
    const sysMsg = await this.sessionService.createSystemMessage(
      conversationId,
      'The session has ended',
    );
    this.sessionGateway.broadcastMessage(conversationId, {
      id: sysMsg.id,
      role: 'SYSTEM',
      content: sysMsg.content,
      createdAt: sysMsg.createdAt,
    });
    this.sessionGateway.broadcastSessionEnded(conversationId);

    return ApiResponseDto.success(
      null,
      'Session ended',
    ) as LeaveSessionResponseDto;
  }

  // =========================================================================
  // MEMBER MANAGEMENT
  // =========================================================================

  @Get(':conversationId/members')
  @ApiOperation({ summary: 'Get session members' })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  @ApiOkResponse({ type: SessionDetailResponseDto })
  async getMembers(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
  ): Promise<SessionDetailResponseDto> {
    const data = await this.sessionService.getSessionDetail(
      user.id,
      conversationId,
    );
    return ApiResponseDto.success(
      data,
      'Session details',
    ) as SessionDetailResponseDto;
  }

  @Delete(':conversationId/members/:userId')
  @ApiOperation({ summary: 'Remove a member from session (owner only)' })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  @ApiParam({ name: 'userId', description: 'User ID to remove' })
  @ApiOkResponse({ type: RemoveMemberResponseDto })
  async removeMember(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Param('userId') targetUserId: string,
  ): Promise<RemoveMemberResponseDto> {
    // Fetch target's display name before removal
    const targetDisplayName =
      await this.sessionService.getUserDisplayName(targetUserId);

    const data = await this.sessionService.removeMember(
      user.id,
      conversationId,
      targetUserId,
    );

    // Create & broadcast system message, then notify via dedicated event
    const sysMsg = await this.sessionService.createSystemMessage(
      conversationId,
      `${targetDisplayName} was removed from the session`,
    );
    this.sessionGateway.broadcastMessage(conversationId, {
      id: sysMsg.id,
      role: 'SYSTEM',
      content: sysMsg.content,
      createdAt: sysMsg.createdAt,
    });
    this.sessionGateway.broadcastMemberRemoved(conversationId, targetUserId);

    return ApiResponseDto.success(
      data,
      'Member removed',
    ) as RemoveMemberResponseDto;
  }

  // =========================================================================
  // INVITE MANAGEMENT
  // =========================================================================

  @Post(':conversationId/invites')
  @ApiOperation({ summary: 'Create a new invite link for a session' })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  @ApiCreatedResponse({ type: CreateInviteResponseDto })
  async createInvite(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Body() dto: CreateInviteDto,
  ): Promise<CreateInviteResponseDto> {
    const data = await this.sessionService.createInvite(
      user.id,
      conversationId,
      dto,
    );
    return ApiResponseDto.success(
      data,
      'Invite created',
    ) as CreateInviteResponseDto;
  }

  @Delete('invites/:inviteToken')
  @ApiOperation({ summary: 'Revoke an invite link (owner only)' })
  @ApiParam({ name: 'inviteToken', description: 'Invite token to revoke' })
  @ApiOkResponse({ type: LeaveSessionResponseDto })
  async revokeInvite(
    @CurrentUser() user: any,
    @Param('inviteToken') inviteToken: string,
  ): Promise<LeaveSessionResponseDto> {
    await this.sessionService.revokeInvite(user.id, inviteToken);
    return ApiResponseDto.success(
      null,
      'Invite revoked',
    ) as LeaveSessionResponseDto;
  }

  // =========================================================================
  // SESSION QUERIES
  // =========================================================================

  @Get()
  @ApiOperation({
    summary: 'List collaborative sessions the user is in',
  })
  @ApiOkResponse({ type: ListSessionsResponseDto })
  async listSessions(
    @CurrentUser() user: any,
  ): Promise<ListSessionsResponseDto> {
    const data = await this.sessionService.listUserSessions(user.id);
    return ApiResponseDto.success(
      data,
      'Sessions listed',
    ) as ListSessionsResponseDto;
  }

  @Get(':conversationId')
  @ApiOperation({ summary: 'Get session detail' })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  @ApiOkResponse({ type: SessionDetailResponseDto })
  async getSession(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
  ): Promise<SessionDetailResponseDto> {
    const data = await this.sessionService.getSessionDetail(
      user.id,
      conversationId,
    );
    return ApiResponseDto.success(
      data,
      'Session detail',
    ) as SessionDetailResponseDto;
  }
}
