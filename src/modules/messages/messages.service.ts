import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name)
    private messageModel: Model<MessageDocument>,
  ) {}

  async create(createMessageDto: CreateMessageDto, senderId: string) {
    const newMessage = await this.messageModel.create({
      conversationId: new Types.ObjectId(createMessageDto.conversationId),
      sender: new Types.ObjectId(senderId),
      content: createMessageDto.content,
      type: createMessageDto.type || 'text',
      isRead: false,
    });

    return await newMessage.populate([
      { path: 'sender', select: 'name email avatar isOnline' },
    ]);
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
