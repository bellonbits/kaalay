import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import axios from 'axios';

export interface LocationData {
  latitude: number;
  longitude: number;
  what3words: string;
}

const W3W_TTL = 86400; // 24 hours — w3w addresses never change

@Injectable()
export class LocationService {
  private readonly w3wApiKey: string;
  private readonly baseUrl = 'https://api.what3words.com/v3';
  private readonly googleApiKey: string;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    this.w3wApiKey  = this.configService.get<string>('W3W_API_KEY') ?? '';
    this.googleApiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY') ?? '';
  }

  async convertToCoordinates(words: string): Promise<LocationData> {
    const key = `w3w:words:${words.toLowerCase()}`;
    const cached = await this.redisService.getClient().get(key).catch(() => null);
    if (cached) return JSON.parse(cached);

    try {
      const { data } = await axios.get(`${this.baseUrl}/convert-to-coordinates`, {
        params: { words, key: this.w3wApiKey },
      });
      const result: LocationData = {
        latitude: data.coordinates.lat,
        longitude: data.coordinates.lng,
        what3words: data.words,
      };
      await this.redisService.getClient().setex(key, W3W_TTL, JSON.stringify(result)).catch(() => null);
      return result;
    } catch {
      throw new HttpException('Failed to convert what3words to coordinates', HttpStatus.BAD_REQUEST);
    }
  }

  async convertTo3wa(lat: number, lng: number): Promise<LocationData> {
    const key = `w3w:coords:${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
    const cached = await this.redisService.getClient().get(key).catch(() => null);
    if (cached) return JSON.parse(cached);

    try {
      const { data } = await axios.get(`${this.baseUrl}/convert-to-3wa`, {
        params: { coordinates: `${lat},${lng}`, key: this.w3wApiKey, language: 'en' },
      });
      const result: LocationData = {
        latitude: data.coordinates.lat,
        longitude: data.coordinates.lng,
        what3words: data.words,
      };
      await this.redisService.getClient().setex(key, W3W_TTL, JSON.stringify(result)).catch(() => null);
      return result;
    } catch {
      throw new HttpException('Failed to convert coordinates to what3words', HttpStatus.BAD_REQUEST);
    }
  }

  async getDistanceAndDuration(
    originLat: number, originLng: number,
    destLat: number, destLng: number,
  ) {
    try {
      const { data } = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
        params: {
          origins: `${originLat},${originLng}`,
          destinations: `${destLat},${destLng}`,
          mode: 'driving',
          key: this.googleApiKey,
        },
      });
      if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
        const el = data.rows[0].elements[0];
        return {
          distance: el.distance.text,
          distanceValue: el.distance.value,
          duration: el.duration.text,
          durationValue: el.duration.value,
        };
      }
      throw new HttpException('Unable to calculate route', HttpStatus.BAD_REQUEST);
    } catch {
      throw new HttpException('Google Maps API failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getGridSection(swLat: number, swLng: number, neLat: number, neLng: number) {
    try {
      const { data } = await axios.get(`${this.baseUrl}/grid-section`, {
        params: { 'bounding-box': `${swLat},${swLng},${neLat},${neLng}`, format: 'geojson', key: this.w3wApiKey },
      });
      return data;
    } catch {
      throw new HttpException('Failed to fetch w3w grid section', HttpStatus.BAD_REQUEST);
    }
  }

  isValidW3W(words: string): boolean {
    return /^\/{0,2}[a-z]+\.[a-z]+\.[a-z]+$/i.test(words);
  }
}
