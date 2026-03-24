import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { LocationService } from './location.service';

@Controller('cities')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get()
  async listCities() {
    return this.locationService.listCities();
  }

  @Get(':code/towns')
  async listTowns(@Param('code', ParseIntPipe) code: number) {
    return this.locationService.listTownsByCityCode(code);
  }
}

