import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Place } from './entities/place.entity';
import { CreatePlaceDto } from './dto/create-place.dto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);
  private readonly PLACES_GEO_KEY = 'local_places_geo';

  constructor(
    @InjectRepository(Place)
    private placesRepository: Repository<Place>,
    private redisService: RedisService,
  ) {}

  async create(createPlaceDto: CreatePlaceDto): Promise<Place> {
    const place = this.placesRepository.create({
      ...createPlaceDto,
      user: createPlaceDto.userId ? { id: createPlaceDto.userId } : undefined,
    });

    const saved = await this.placesRepository.save(place);

    await this.redisService.updateLocation(
      this.PLACES_GEO_KEY,
      saved.id,
      saved.latitude,
      saved.longitude,
    ).catch(() => null);

    return saved;
  }

  async findNearby(lat: number, lng: number, radiusKm = 2): Promise<Place[]> {
    const nearbyIds = await this.redisService.getNearby(this.PLACES_GEO_KEY, lat, lng, radiusKm);
    if (!nearbyIds || nearbyIds.length === 0) return [];

    const ids = (nearbyIds as [string, ...unknown[]][]).map(item => item[0]);
    return this.placesRepository.findBy({ id: ids as any });
  }

  async search(query: string): Promise<Place[]> {
    return this.placesRepository.find({
      where: [
        { name: Like(`%${query}%`) },
        { what3words: Like(`%${query}%`) },
      ],
      take: 20,
    });
  }

  async findOne(id: string): Promise<Place> {
    const place = await this.placesRepository.findOne({ where: { id }, relations: ['user'] });
    if (!place) throw new NotFoundException('Place not found');
    return place;
  }

  async findAll() {
    return this.placesRepository.find({ order: { createdAt: 'DESC' }, take: 100 });
  }
}
