import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { MessageService } from './message.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async send(@Request() req: any, @Body() body: { receiverId: number; announceId?: number; content: string }) {
    return this.messageService.sendMessage(req.user.userId, body.receiverId, body.announceId || null, body.content);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getInbox(@Request() req: any) {
    return this.messageService.getMyMessages(req.user.userId);
  }
}
