import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MessagesService } from '../messages/messages.service';
import { ConversationsService } from '../conversations/conversations.service';
import { UsersService } from '../users/users.service';
import { WsJwtGuard } from './guards/ws-jwt.guard';

interface AuthenticatedSocket extends Socket {
  user: {
    _id: string;
    email: string;
    name: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket'],
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(
    @Inject(forwardRef(() => MessagesService))
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        console.log('No token provided, disconnecting...');
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      if (!userId) {
        console.log('Invalid token payload, disconnecting...');
        client.disconnect();
        return;
      }

      // Attach user info to socket
      client['user'] = {
        _id: userId,
        email: payload.email,
        name: payload.name,
      };

      // Store connection
      this.connectedUsers.set(userId, client.id);

      // Join user into their own room (for direct messaging)
      client.join(`user:${userId}`);

      // Update online status
      await this.usersService.updateOnlineStatus(userId, true);

      // Broadcast user online status
      this.server.emit('user:online', { userId });

      console.log(`User ${userId} connected with socket ${client.id}`);
    } catch (error) {
      console.error('Connection error:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const userId = Array.from(this.connectedUsers.entries()).find(
        ([, socketId]) => socketId === client.id,
      )?.[0];

      if (userId) {
        this.connectedUsers.delete(userId);
        const updatedUser = await this.usersService.updateOnlineStatus(
          userId,
          false,
        );

        // Broadcast user offline status with lastSeen
        this.server.emit('user:offline', {
          userId,
          lastSeen: updatedUser?.lastSeen || new Date(),
        });

        console.log(`User ${userId} disconnected`);
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('join-conversation')
  handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.join(`conversation:${data.conversationId}`);
    console.log(
      `User ${client.user._id} joined conversation ${data.conversationId}`,
    );
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leave-conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.leave(`conversation:${data.conversationId}`);
    console.log(
      `User ${client.user._id} left conversation ${data.conversationId}`,
    );
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: { conversationId: string; content: string; receiverId: string },
  ) {
    try {
      // Create message
      const message = await this.messagesService.create(
        {
          conversationId: data.conversationId,
          content: data.content,
          receiverId: data.receiverId,
          type: 'text',
        },
        client.user._id,
      );

      // Update conversation's lastMessage
      await this.conversationsService.updateLastMessage(
        data.conversationId,
        message._id.toString(),
      );

      // Emit to all users in the conversation room
      this.server
        .to(`conversation:${data.conversationId}`)
        .emit('newMessage', message);

      // Also emit to the receiver if they're online but not in the room
      const receiverSocketId = this.connectedUsers.get(data.receiverId);
      if (receiverSocketId) {
        this.server.to(receiverSocketId).emit('newMessage', message);
      }

      return { success: true, message };
    } catch (error) {
      console.error('Send message error:', error);
      return { success: false, error: error.message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; receiverId?: string },
  ) {
    // Emit to conversation room
    this.server.to(`conversation:${data.conversationId}`).emit('user:typing', {
      conversationId: data.conversationId,
      userId: client.user._id,
      userName: client.user.name,
    });

    // Also emit directly to receiver if specified
    if (data.receiverId) {
      const receiverSocketId = this.connectedUsers.get(data.receiverId);
      if (receiverSocketId) {
        this.server.to(receiverSocketId).emit('user:typing', {
          conversationId: data.conversationId,
          userId: client.user._id,
          userName: client.user.name,
        });
      }
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('stopTyping')
  @SubscribeMessage('stopped-typing')
  handleStopTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; receiverId?: string },
  ) {
    // Emit to conversation room
    this.server
      .to(`conversation:${data.conversationId}`)
      .emit('user:stopped-typing', {
        conversationId: data.conversationId,
        userId: client.user._id,
      });

    // Also emit directly to receiver if specified
    if (data.receiverId) {
      const receiverSocketId = this.connectedUsers.get(data.receiverId);
      if (receiverSocketId) {
        this.server.to(receiverSocketId).emit('user:stopped-typing', {
          conversationId: data.conversationId,
          userId: client.user._id,
        });
      }
    }
  }

  // Public method for MessagesService to emit new message
  emitNewMessage(message: any) {
    const receiverId = message.receiver || message.receiverId;

    // Emit to conversation room
    this.server
      .to(`conversation:${message.conversationId}`)
      .emit('message:received', message);

    // Also emit directly to receiver's room if they're online
    if (receiverId) {
      this.server.to(`user:${receiverId}`).emit('message:received', message);
    }

    console.log(`Message emitted to conversation ${message.conversationId}`);
  }
}
