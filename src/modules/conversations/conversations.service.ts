import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateConversationDto } from './dto/create-conversation.dto';
import {
  Conversation,
  ConversationDocument,
} from './schemas/conversation.schema';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private conversationModel: Model<ConversationDocument>,
  ) {}

  async create(createConversationDto: CreateConversationDto, userId: string) {
    const { participantId } = createConversationDto;

    // Check if conversation already exists
    const existingConversation = await this.conversationModel
      .findOne({
        participants: {
          $all: [new Types.ObjectId(userId), new Types.ObjectId(participantId)],
        },
      })
      .populate('participants', 'name email avatar isOnline')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'name email avatar' },
      });

    if (existingConversation) {
      return existingConversation;
    }

    // Create new conversation
    const newConversation = await this.conversationModel.create({
      participants: [
        new Types.ObjectId(userId),
        new Types.ObjectId(participantId),
      ],
    });

    return await newConversation.populate(
      'participants',
      'name email avatar isOnline',
    );
  }

  async findAllByUser(userId: string) {
    const conversations = await this.conversationModel
      .find({
        participants: new Types.ObjectId(userId),
      })
      .sort({ updatedAt: -1 })
      .populate('participants', 'name email avatar isOnline')
      .populate({
        path: 'lastMessage',
        select: 'content type sender createdAt',
      })
      .exec();

    return conversations;
  }

  async findOne(id: string) {
    return await this.conversationModel
      .findById(id)
      .populate('participants', 'name email avatar isOnline')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'name email avatar' },
      })
      .exec();
  }

  async updateLastMessage(conversationId: string, messageId: string) {
    return await this.conversationModel
      .findByIdAndUpdate(
        conversationId,
        { lastMessage: new Types.ObjectId(messageId) },
        { new: true },
      )
      .exec();
  }

  async findByParticipants(userId1: string, userId2: string) {
    return await this.conversationModel
      .findOne({
        participants: {
          $all: [new Types.ObjectId(userId1), new Types.ObjectId(userId2)],
        },
      })
      .exec();
  }
}
