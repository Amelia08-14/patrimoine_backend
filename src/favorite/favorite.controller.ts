import { Controller, Post, Get, Param, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { FavoriteService } from './favorite.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('favorites')
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @UseGuards(JwtAuthGuard)
  @Post(':id')
  async toggle(@Request() req: any, @Param('id', ParseIntPipe) announceId: number) {
    return this.favoriteService.toggleFavorite(req.user.userId, announceId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyFavorites(@Request() req: any) {
    return this.favoriteService.getMyFavorites(req.user.userId);
  }
}
