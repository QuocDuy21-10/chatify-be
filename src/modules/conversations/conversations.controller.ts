import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MessagesService } from '../messages/messages.service';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService, // Inject MessagesService
  ) {}

  @Post()
  create(@Body() createConversationDto: CreateConversationDto, @Req() req) {
    return this.conversationsService.create(
      createConversationDto,
      req.user._id,
    );
  }

  @Get()
  findAll(@Req() req) {
    return this.conversationsService.findAllByUser(req.user._id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.conversationsService.findOne(id);
  }

  @Get(':id/messages')
  async getConversationMessages(
    @Param('id') conversationId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    return await this.messagesService.findByConversation(
      conversationId,
      Number(page),
      Number(limit),
    );
  }
}
