// src/session/session.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SessionService } from './session.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * WebSocket gateway for real-time collaborative session events.
 *
 * Events emitted to clients:
 * - 'session:user-joined'    — A user joined the session
 * - 'session:user-left'      — A user left the session
 * - 'session:new-message'    — A new chat message (user or assistant)
 * - 'session:typing'         — A user is typing
 * - 'session:highlight-added'    — A new highlight was created
 * - 'session:highlight-updated'  — A highlight was updated
 * - 'session:highlight-deleted'  — A highlight was deleted
 * - 'session:comment-added'      — A comment was added to a highlight
 * - 'session:member-removed'     — A member was removed by owner
 * - 'session:ended'              — Session was ended by owner
 *
 * Events received from clients:
 * - 'session:join'           — Join a session room
 * - 'session:leave'          — Leave a session room
 * - 'session:send-message'   — Send a chat message
 * - 'session:typing-start'   — User started typing
 * - 'session:typing-stop'    — User stopped typing
 * - 'session:cursor-move'    — User cursor/scroll position on PDF
 */
@WebSocketGateway({
  namespace: '/session',
  cors: {
    origin: '*', // Configure properly in production
    credentials: true,
  },
})
export class SessionGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SessionGateway.name);

  // Track connected users: socketId -> { userId, conversationId }
  private readonly connectedUsers = new Map<
    string,
    {
      userId: string;
      conversationId: string;
      displayName: string;
      avatarUrl: string | null;
    }
  >();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
    private readonly prisma: PrismaService,
  ) {}

  // =========================================================================
  // CONNECTION LIFECYCLE
  // =========================================================================

  async handleConnection(client: Socket) {
    try {
      // Extract JWT from handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      this.logger.debug(
        `[handleConnection] Client ${client.id} attempting connection. ` +
          `Token present: ${!!token}, Auth keys: ${JSON.stringify(Object.keys(client.handshake.auth || {}))}`,
      );

      if (!token) {
        this.logger.warn(
          `[handleConnection] Client ${client.id} connected WITHOUT token — disconnecting`,
        );
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_ACCESS_SECRET'),
      });

      // Attach user info to socket
      (client as any).userId = payload.sub;
      (client as any).email = payload.email;

      this.logger.log(
        `[handleConnection] ✅ Client ${client.id} authenticated — userId: ${payload.sub}, email: ${payload.email}`,
      );
    } catch (error) {
      this.logger.error(
        `[handleConnection] ❌ Client ${client.id} auth FAILED: ${error.message}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userData = this.connectedUsers.get(client.id);
    this.logger.log(
      `[handleDisconnect] Client ${client.id} disconnecting. ` +
        `userData: ${userData ? JSON.stringify(userData) : 'none'}`,
    );

    if (userData) {
      const roomName = `session:${userData.conversationId}`;
      // Notify room that user disconnected
      this.server.to(roomName).emit('session:user-left', {
        userId: userData.userId,
        displayName: userData.displayName,
        timestamp: new Date(),
      });

      this.logger.log(
        `[handleDisconnect] Emitted 'session:user-left' to room ${roomName} for user ${userData.userId}`,
      );

      this.connectedUsers.delete(client.id);
    }
    this.logger.log(
      `[handleDisconnect] connectedUsers count: ${this.connectedUsers.size}`,
    );
  }

  // =========================================================================
  // SESSION ROOM MANAGEMENT
  // =========================================================================

  @SubscribeMessage('session:join')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = (client as any).userId;
    this.logger.log(
      `[session:join] Client ${client.id} — userId: ${userId}, conversationId: ${data?.conversationId}`,
    );

    if (!userId) {
      this.logger.warn(`[session:join] Client ${client.id} NOT authenticated`);
      throw new WsException('Not authenticated');
    }

    // Verify membership
    const { hasAccess } = await this.sessionService.checkAccess(
      userId,
      data.conversationId,
    );
    this.logger.log(
      `[session:join] Access check for user ${userId} on ${data.conversationId}: ${hasAccess}`,
    );
    if (!hasAccess) throw new WsException('Not a member of this session');

    // Get user info
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, avatarUrl: true },
    });

    const roomName = `session:${data.conversationId}`;

    // Join socket.io room
    client.join(roomName);

    // Track connection
    this.connectedUsers.set(client.id, {
      userId,
      conversationId: data.conversationId,
      displayName: user?.displayName || 'Anonymous',
      avatarUrl: user?.avatarUrl || null,
    });

    // Notify others
    client.to(roomName).emit('session:user-joined', {
      userId,
      displayName: user?.displayName || 'Anonymous',
      avatarUrl: user?.avatarUrl || null,
      timestamp: new Date(),
    });

    // Return online members to the joining user
    const onlineMembers = this.getOnlineMembers(data.conversationId);

    // Log room state
    const roomSockets = this.server.adapter;
    this.logger.log(
      `[session:join] ✅ User ${userId} (${user?.displayName}) joined room ${roomName}. ` +
        `Online members: ${JSON.stringify(onlineMembers)}. ` +
        `Total connectedUsers: ${this.connectedUsers.size}`,
    );

    return { conversationId: data.conversationId, onlineMembers };
  }

  @SubscribeMessage('session:leave')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const roomName = `session:${data.conversationId}`;
    const userData = this.connectedUsers.get(client.id);

    this.logger.log(
      `[session:leave] Client ${client.id} leaving room ${roomName}. userData: ${userData ? JSON.stringify(userData) : 'none'}`,
    );

    client.leave(roomName);

    if (userData) {
      client.to(roomName).emit('session:user-left', {
        userId: userData.userId,
        displayName: userData.displayName,
        timestamp: new Date(),
      });
      this.connectedUsers.delete(client.id);
      this.logger.log(
        `[session:leave] ✅ Emitted 'session:user-left' for user ${userData.userId}. connectedUsers count: ${this.connectedUsers.size}`,
      );
    }

    return { conversationId: data.conversationId };
  }

  // =========================================================================
  // REAL-TIME MESSAGING
  // =========================================================================

  @SubscribeMessage('session:typing-start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userData = this.connectedUsers.get(client.id);
    if (!userData) {
      this.logger.warn(
        `[session:typing-start] Client ${client.id} not in connectedUsers — ignoring`,
      );
      return;
    }

    this.logger.debug(
      `[session:typing-start] User ${userData.userId} (${userData.displayName}) in conversation ${data.conversationId}`,
    );

    client.to(`session:${data.conversationId}`).emit('session:typing', {
      userId: userData.userId,
      displayName: userData.displayName,
      avatarUrl: userData.avatarUrl || null,
      isTyping: true,
    });
  }

  @SubscribeMessage('session:typing-stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userData = this.connectedUsers.get(client.id);
    if (!userData) {
      this.logger.warn(
        `[session:typing-stop] Client ${client.id} not in connectedUsers — ignoring`,
      );
      return;
    }

    this.logger.debug(
      `[session:typing-stop] User ${userData.userId} (${userData.displayName}) in conversation ${data.conversationId}`,
    );

    client.to(`session:${data.conversationId}`).emit('session:typing', {
      userId: userData.userId,
      displayName: userData.displayName,
      avatarUrl: userData.avatarUrl || null,
      isTyping: false,
    });
  }

  @SubscribeMessage('session:cursor-move')
  handleCursorMove(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      conversationId: string;
      pageNumber: number;
      scrollPosition: number;
    },
  ) {
    const userData = this.connectedUsers.get(client.id);
    if (!userData) {
      this.logger.warn(
        `[session:cursor-move] Client ${client.id} not in connectedUsers — ignoring`,
      );
      return;
    }

    // cursor-move is high-frequency so use verbose/debug only
    this.logger.verbose?.(
      `[session:cursor-move] User ${userData.userId} page ${data.pageNumber} scroll ${data.scrollPosition}`,
    );

    client.to(`session:${data.conversationId}`).emit('session:cursor-move', {
      userId: userData.userId,
      displayName: userData.displayName,
      pageNumber: data.pageNumber,
      scrollPosition: data.scrollPosition,
    });
  }

  // =========================================================================
  // BROADCAST HELPERS (called from services)
  // =========================================================================

  /**
   * Broadcast a new message to all session participants.
   */
  broadcastMessage(
    conversationId: string,
    message: {
      id: string;
      role: string;
      content: string;
      userId?: string;
      displayName?: string;
      avatarUrl?: string;
      imageUrl?: string;
      context?: any;
      replyToMessageId?: string;
      replyTo?: {
        id: string;
        content: string;
        role: string;
        displayName?: string;
        isDeleted?: boolean;
      };
      createdAt: Date;
    },
  ) {
    const roomName = `session:${conversationId}`;
    this.logger.log(
      `[broadcastMessage] → room ${roomName} | msgId: ${message.id}, role: ${message.role}, ` +
        `userId: ${message.userId || 'N/A'}, content: "${message.content?.substring(0, 80)}..."`,
    );
    this.server.to(roomName).emit('session:new-message', message);
  }

  /**
   * Broadcast assistant thinking state to all session participants.
   * Used when @Assistant is invoked: emits immediately so all members
   * see a thinking indicator while the AI processes the request.
   */
  broadcastAssistantThinking(conversationId: string, isThinking: boolean) {
    const roomName = `session:${conversationId}`;
    this.logger.log(
      `[broadcastAssistantThinking] → room ${roomName} | isThinking: ${isThinking}`,
    );
    this.server.to(roomName).emit('session:assistant-thinking', { isThinking });
  }

  /**
   * Broadcast a reaction update to all session participants.
   */
  broadcastReactionUpdate(
    conversationId: string,
    data: {
      messageId: string;
      reactions: Array<{
        emoji: string;
        count: number;
        hasReacted: boolean;
        reactedBy: Array<{ userId: string; displayName: string }>;
      }>;
      action: 'added' | 'removed' | 'updated';
      userId: string;
      emoji: string;
    },
  ) {
    const roomName = `session:${conversationId}`;
    this.logger.log(
      `[broadcastReactionUpdate] → room ${roomName} | msgId: ${data.messageId}, action: ${data.action}, emoji: ${data.emoji}, userId: ${data.userId}`,
    );
    this.server.to(roomName).emit('session:reaction-update', data);
  }

  /**
   * Broadcast a message deletion event to all session participants.
   */
  broadcastMessageDeleted(
    conversationId: string,
    data: { messageId: string; userId: string },
  ) {
    const roomName = `session:${conversationId}`;
    this.logger.log(
      `[broadcastMessageDeleted] → room ${roomName} | msgId: ${data.messageId}, userId: ${data.userId}`,
    );
    this.server.to(roomName).emit('session:message-deleted', data);
  }

  /**
   * Broadcast highlight events to all session participants.
   */
  broadcastHighlightEvent(
    conversationId: string,
    eventType: 'added' | 'updated' | 'deleted',
    highlight: any,
  ) {
    const roomName = `session:${conversationId}`;
    this.logger.log(
      `[broadcastHighlightEvent] → room ${roomName} | type: highlight-${eventType}, highlightId: ${highlight?.id || 'N/A'}`,
    );
    this.server.to(roomName).emit(`session:highlight-${eventType}`, highlight);
  }

  /**
   * Broadcast comment events to all session participants.
   */
  broadcastCommentEvent(
    conversationId: string,
    eventType: 'added' | 'updated' | 'deleted',
    comment: any,
  ) {
    const roomName = `session:${conversationId}`;
    this.logger.log(
      `[broadcastCommentEvent] → room ${roomName} | type: comment-${eventType}, commentId: ${comment?.id || 'N/A'}, highlightId: ${comment?.highlightId || 'N/A'}`,
    );
    this.server.to(roomName).emit(`session:comment-${eventType}`, comment);
  }

  /**
   * Notify all members that a user was removed.
   */
  broadcastMemberRemoved(conversationId: string, userId: string) {
    const roomName = `session:${conversationId}`;
    this.logger.log(
      `[broadcastMemberRemoved] → room ${roomName} | removedUserId: ${userId}`,
    );
    this.server
      .to(roomName)
      .emit('session:member-removed', { userId, timestamp: new Date() });
  }

  /**
   * Notify all members that the session ended.
   */
  broadcastSessionEnded(conversationId: string) {
    const roomName = `session:${conversationId}`;
    this.logger.log(`[broadcastSessionEnded] → room ${roomName}`);
    this.server.to(roomName).emit('session:ended', { timestamp: new Date() });
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private getOnlineMembers(
    conversationId: string,
  ): Array<{ userId: string; displayName: string; avatarUrl: string | null }> {
    const members: Array<{
      userId: string;
      displayName: string;
      avatarUrl: string | null;
    }> = [];
    const seen = new Set<string>();

    for (const [, userData] of this.connectedUsers) {
      if (
        userData.conversationId === conversationId &&
        !seen.has(userData.userId)
      ) {
        members.push({
          userId: userData.userId,
          displayName: userData.displayName,
          avatarUrl: userData.avatarUrl,
        });
        seen.add(userData.userId);
      }
    }

    return members;
  }
}
