import { Controller, Get, Patch, Post, Param, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  findMine(@Request() req: any) {
    return this.notificationService.findMine(req.user.userId);
  }

  // Léger, pour le badge de la cloche dans la Navbar — appelé plus souvent que la liste complète.
  @Get('unread-count')
  unreadCount(@Request() req: any) {
    return this.notificationService.unreadCount(req.user.userId);
  }

  @Patch(':id/read')
  markRead(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.notificationService.markRead(req.user.userId, id);
  }

  @Post('read-all')
  markAllRead(@Request() req: any) {
    return this.notificationService.markAllRead(req.user.userId);
  }
}
