import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { GetMessagesDto } from './dto/get-messages.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { MarkAsReadDto } from './dto/mark-as-read.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  async getMessages(@Query() query: GetMessagesDto) {
    return await this.messagesService.findByConversation(
      query.conversationId,
      query.page,
      query.limit,
    );
  }

  @Post()
  async sendMessage(@Body() createMessageDto: CreateMessageDto, @Req() req) {
    const senderId = req.user._id;
    const message = await this.messagesService.create(
      createMessageDto,
      senderId,
    );
    return {
      data: message,
    };
  }

  @Post('mark-as-read')
  async markAsRead(@Body() markAsReadDto: MarkAsReadDto) {
    await this.messagesService.markAsRead(markAsReadDto.messageIds);
    return {
      message: 'Messages marked as read successfully',
    };
  }
}
