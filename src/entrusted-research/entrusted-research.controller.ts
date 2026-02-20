import { Controller, Post, Body, Get } from '@nestjs/common';
import { EntrustedResearchService } from './entrusted-research.service';
import { CreateEntrustedResearchDto } from './dto/create-entrusted-research.dto';

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
}
