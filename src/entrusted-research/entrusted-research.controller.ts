import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { EntrustedResearchService } from './entrusted-research.service';
import { CreateEntrustedResearchDto } from './dto/create-entrusted-research.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('entrusted-research')
export class EntrustedResearchController {
  constructor(private readonly service: EntrustedResearchService) {}

  @Post()
  create(@Body() createDto: CreateEntrustedResearchDto) {
    return this.service.create(createDto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  // Déclarée avant toute route à paramètre pour éviter un conflit de routage ("mine" pris pour un :id).
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  findMine(@Request() req: any) {
    return this.service.findAll(req.user.userId);
  }
}
