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
import { UseGuards } from '@nestjs/common';
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
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
    private readonly usersService: UsersService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        client.disconnect();
        return;
      }

      // Verify token and get user (you'll need to implement this)
      // For now, we'll assume the user is passed via handshake
      const userId = client.handshake.auth.userId;

      if (userId) {
        this.connectedUsers.set(userId, client.id);
        await this.usersService.updateOnlineStatus(userId, true);

        // Notify all users about this user's online status
        this.server.emit('userStatusUpdate', {
          userId,
          isOnline: true,
        });

        console.log(`User ${userId} connected with socket ${client.id}`);
      }
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
        await this.usersService.updateOnlineStatus(userId, false);

        this.server.emit('userStatusUpdate', {
          userId,
          isOnline: false,
        });

        console.log(`User ${userId} disconnected`);
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('joinConversation')
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
  @SubscribeMessage('leaveConversation')
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
    @MessageBody() data: { conversationId: string; receiverId: string },
  ) {
    const receiverSocketId = this.connectedUsers.get(data.receiverId);
    if (receiverSocketId) {
      this.server.to(receiverSocketId).emit('typing', {
        conversationId: data.conversationId,
        userId: client.user._id,
        userName: client.user.name,
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('stopTyping')
  handleStopTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; receiverId: string },
  ) {
    const receiverSocketId = this.connectedUsers.get(data.receiverId);
    if (receiverSocketId) {
      this.server.to(receiverSocketId).emit('stopTyping', {
        conversationId: data.conversationId,
        userId: client.user._id,
      });
    }
  }
}
