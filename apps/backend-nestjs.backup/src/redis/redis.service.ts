import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
    });
  }

  onModuleDestroy() {
    this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  // Helper for GEO queries
  async updateLocation(key: string, id: string, lat: number, lng: number) {
    return this.client.geoadd(key, lng, lat, id);
  }

  async getNearby(key: string, lat: number, lng: number, radiusKm: number) {
    // GEORADIUS returns [id, distance, [lng, lat]] if requested
    // Note: modern Redis users use GEOSEARCH, but ioredis supports both.
    return this.client.georadius(key, lng, lat, radiusKm, 'km', 'WITHDIST', 'WITHCOORD', 'ASC');
  }
}
