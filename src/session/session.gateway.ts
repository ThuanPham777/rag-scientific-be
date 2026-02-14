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
    { userId: string; conversationId: string; displayName: string }
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

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      // Attach user info to socket
      (client as any).userId = payload.sub;
      (client as any).email = payload.email;

      this.logger.log(`Client connected: ${client.id} (user: ${payload.sub})`);
    } catch (error) {
      this.logger.warn(
        `Client ${client.id} failed authentication: ${error.message}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userData = this.connectedUsers.get(client.id);
    if (userData) {
      // Notify room that user disconnected
      this.server
        .to(`session:${userData.conversationId}`)
        .emit('session:user-left', {
          userId: userData.userId,
          displayName: userData.displayName,
          timestamp: new Date(),
        });

      this.connectedUsers.delete(client.id);
    }
    this.logger.log(`Client disconnected: ${client.id}`);
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
    if (!userId) throw new WsException('Not authenticated');

    // Verify membership
    const { hasAccess } = await this.sessionService.checkAccess(
      userId,
      data.conversationId,
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

    return {
      event: 'session:joined',
      data: { conversationId: data.conversationId, onlineMembers },
    };
  }

  @SubscribeMessage('session:leave')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const roomName = `session:${data.conversationId}`;
    const userData = this.connectedUsers.get(client.id);

    client.leave(roomName);

    if (userData) {
      client.to(roomName).emit('session:user-left', {
        userId: userData.userId,
        displayName: userData.displayName,
        timestamp: new Date(),
      });
      this.connectedUsers.delete(client.id);
    }

    return {
      event: 'session:left',
      data: { conversationId: data.conversationId },
    };
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
    if (!userData) return;

    client.to(`session:${data.conversationId}`).emit('session:typing', {
      userId: userData.userId,
      displayName: userData.displayName,
      isTyping: true,
    });
  }

  @SubscribeMessage('session:typing-stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userData = this.connectedUsers.get(client.id);
    if (!userData) return;

    client.to(`session:${data.conversationId}`).emit('session:typing', {
      userId: userData.userId,
      displayName: userData.displayName,
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
    if (!userData) return;

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
      imageUrl?: string;
      context?: any;
      createdAt: Date;
    },
  ) {
    this.server
      .to(`session:${conversationId}`)
      .emit('session:new-message', message);
  }

  /**
   * Broadcast highlight events to all session participants.
   */
  broadcastHighlightEvent(
    conversationId: string,
    eventType: 'added' | 'updated' | 'deleted',
    highlight: any,
  ) {
    this.server
      .to(`session:${conversationId}`)
      .emit(`session:highlight-${eventType}`, highlight);
  }

  /**
   * Broadcast comment event to all session participants.
   */
  broadcastCommentEvent(conversationId: string, comment: any) {
    this.server
      .to(`session:${conversationId}`)
      .emit('session:comment-added', comment);
  }

  /**
   * Notify all members that a user was removed.
   */
  broadcastMemberRemoved(conversationId: string, userId: string) {
    this.server
      .to(`session:${conversationId}`)
      .emit('session:member-removed', { userId, timestamp: new Date() });
  }

  /**
   * Notify all members that the session ended.
   */
  broadcastSessionEnded(conversationId: string) {
    this.server
      .to(`session:${conversationId}`)
      .emit('session:ended', { timestamp: new Date() });
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private getOnlineMembers(
    conversationId: string,
  ): Array<{ userId: string; displayName: string }> {
    const members: Array<{ userId: string; displayName: string }> = [];
    const seen = new Set<string>();

    for (const [, userData] of this.connectedUsers) {
      if (
        userData.conversationId === conversationId &&
        !seen.has(userData.userId)
      ) {
        members.push({
          userId: userData.userId,
          displayName: userData.displayName,
        });
        seen.add(userData.userId);
      }
    }

    return members;
  }
}
