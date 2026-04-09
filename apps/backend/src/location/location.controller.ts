import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { LocationService } from './location.service';

@Controller('location')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get('convert-to-coordinates')
  async convertToCoordinates(@Query('words') words: string) {
    if (!words) {
      throw new BadRequestException('what3words (words) is required');
    }
    return this.locationService.convertToCoordinates(words);
  }

  @Get('convert-to-3wa')
  async convertTo3wa(@Query('lat') lat: number, @Query('lng') lng: number) {
    if (lat === undefined || lng === undefined) {
      throw new BadRequestException('lat and lng are required');
    }
    return this.locationService.convertTo3wa(lat, lng);
  }

  @Get('validate')
  validate(@Query('words') words: string) {
    return {
      isValid: this.locationService.isValidW3W(words),
    };
  }
}
