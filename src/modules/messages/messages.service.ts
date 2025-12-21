import { ConversationDocument } from './../conversations/schemas/conversation.schema';
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatGateway } from '../chat/chat.gateway';
import { Conversation } from '../conversations/schemas/conversation.schema';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name)
    private messageModel: Model<MessageDocument>,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
    @InjectModel(Conversation.name)
    private conversationModel: Model<ConversationDocument>,
  ) {}

  async create(createMessageDto: CreateMessageDto, senderId: string) {
    const newMessage = await this.messageModel.create({
      conversationId: new Types.ObjectId(createMessageDto.conversationId),
      sender: new Types.ObjectId(senderId),
      content: createMessageDto.content,
      type: createMessageDto.type || 'text',
      isRead: false,
    });

    await this.conversationModel.findByIdAndUpdate(
      createMessageDto.conversationId,
      {
        lastMessage: newMessage._id,
        updatedAt: new Date(),
      },
    );

    const populatedMessage = await newMessage.populate([
      { path: 'sender', select: 'name email avatar isOnline' },
    ]);

    // Emit real-time message to receiver
    this.chatGateway.emitNewMessage({
      ...populatedMessage.toObject(),
      receiverId: createMessageDto.receiverId,
    });

    return populatedMessage;
  }

  async findByConversation(
    conversationId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const skip = (page - 1) * limit;

    const messages = await this.messageModel
      .find({ conversationId: new Types.ObjectId(conversationId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'name email avatar isOnline')
      .exec();

    const total = await this.messageModel.countDocuments({
      conversationId: new Types.ObjectId(conversationId),
    });

    return {
      data: messages.reverse(),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(messageIds: string[]) {
    const objectIds = messageIds.map((id) => new Types.ObjectId(id));
    return await this.messageModel.updateMany(
      { _id: { $in: objectIds } },
      { isRead: true },
    );
  }

  async getLastMessage(conversationId: string) {
    return await this.messageModel
      .findOne({ conversationId: new Types.ObjectId(conversationId) })
      .sort({ createdAt: -1 })
      .populate('sender', 'name email avatar')
      .exec();
  }
}
