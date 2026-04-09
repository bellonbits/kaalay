import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface LocationData {
  latitude: number;
  longitude: number;
  what3words: string;
}

@Injectable()
export class LocationService {
  private readonly w3wApiKey: string;
  private readonly baseUrl = 'https://api.what3words.com/v3';

  constructor(private configService: ConfigService) {
    this.w3wApiKey = this.configService.get<string>('W3W_API_KEY');
  }

  async convertToCoordinates(words: string): Promise<LocationData> {
    try {
      const response = await axios.get(`${this.baseUrl}/convert-to-coordinates`, {
        params: {
          words,
          key: this.w3wApiKey,
        },
      });

      const { coordinates, words: w3w } = response.data;
      return {
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        what3words: w3w,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to convert what3words to coordinates',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async convertTo3wa(lat: number, lng: number): Promise<LocationData> {
    try {
      const response = await axios.get(`${this.baseUrl}/convert-to-3wa`, {
        params: {
          coordinates: `${lat},${lng}`,
          key: this.w3wApiKey,
        },
      });

      const { coordinates, words } = response.data;
      return {
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        what3words: words,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to convert coordinates to what3words',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Validate if string is a valid what3words format (word.word.word)
  isValidW3W(words: string): boolean {
    const regex = /^\/{0,2}[a-z]+\.[a-z]+\.[a-z]+$/i;
    return regex.test(words);
  }
}
