import { Controller, Post, Get, Patch, Param, ParseIntPipe, Body, UseGuards, Request } from '@nestjs/common';
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

  // Ouvrir une conversation marque comme lus les messages reçus de cet interlocuteur (jusqu'ici
  // aucun endpoint ne le faisait : le badge "non lus" ne baissait jamais en base).
  @UseGuards(JwtAuthGuard)
  @Patch('read/:partnerId')
  async markRead(@Request() req: any, @Param('partnerId', ParseIntPipe) partnerId: number) {
    return this.messageService.markConversationRead(req.user.userId, partnerId);
  }
}
