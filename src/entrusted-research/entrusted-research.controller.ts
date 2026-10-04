import { Controller, Post, Body, Get, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
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

  @Get('count')
  count() {
    return this.service.count();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOnePublic(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/email')
  email(@Param('id', ParseIntPipe) id: number) {
    return this.service.getContactEmail(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/contact-request')
  contactRequest(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.requestContact(req.user.userId, id);
  }
}
