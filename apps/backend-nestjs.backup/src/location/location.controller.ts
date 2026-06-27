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

  @Get('distance')
  async getDistance(
    @Query('originLat') originLat: number,
    @Query('originLng') originLng: number,
    @Query('destLat') destLat: number,
    @Query('destLng') destLng: number,
  ) {
    if (originLat === undefined || destLat === undefined) {
      throw new BadRequestException('All coordinates are required');
    }
    return this.locationService.getDistanceAndDuration(originLat, originLng, destLat, destLng);
  }

  @Get('grid-section')
  async getGridSection(
    @Query('swLat') swLat: number,
    @Query('swLng') swLng: number,
    @Query('neLat') neLat: number,
    @Query('neLng') neLng: number,
  ) {
    if (swLat === undefined || swLng === undefined || neLat === undefined || neLng === undefined) {
      throw new BadRequestException('Bounding box coordinates are required');
    }
    return this.locationService.getGridSection(swLat, swLng, neLat, neLng);
  }

  @Get('validate')
  validate(@Query('words') words: string) {
    return {
      isValid: this.locationService.isValidW3W(words),
    };
  }
}
