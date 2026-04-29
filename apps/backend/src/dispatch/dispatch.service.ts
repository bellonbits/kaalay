import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver, DriverStatus } from '../drivers/entities/driver.entity';
import { Ride, RideStatus } from '../rides/entities/ride.entity';

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);
  private readonly DRIVER_LOCATIONS_KEY = 'driver_locations';

  constructor(
    private redisService: RedisService,
    @InjectRepository(Driver)
    private driverRepository: Repository<Driver>,
    @InjectRepository(Ride)
    private rideRepository: Repository<Ride>,
  ) {}

  async findBestDriver(lat: number, lng: number, radiusKm: number = 5): Promise<string | null> {
    this.logger.log(`Finding best driver near ${lat}, ${lng} within ${radiusKm}km`);
    
    // 1. Get nearby drivers from Redis
    const nearby = await this.redisService.getNearby(this.DRIVER_LOCATIONS_KEY, lat, lng, radiusKm);
    
    if (!nearby || nearby.length === 0) {
      this.logger.warn('No nearby drivers found in Redis');
      return null;
    }

    const scoredDrivers: { id: string; score: number }[] = [];

    // 2. Fetch driver data and calculate scores
    for (const item of nearby as any[]) {
      const [driverId, distanceStr] = item;
      const distance = parseFloat(distanceStr);

      const driver = await this.driverRepository.findOne({
        where: { id: driverId, status: DriverStatus.ONLINE },
      });

      if (driver) {
        // Scoring formula:
        // distScore: 1 / (distance + 0.5) -- higher is better (closer)
        // ratingScore: rating / 5 -- higher is better
        // acceptanceScore: acceptanceRate -- higher is better (0-1)
        
        const distScore = 1 / (distance + 0.5);
        const ratingScore = driver.rating / 5;
        const acceptanceScore = driver.acceptanceRate;

        // Weights: 40% Distance, 40% Rating, 20% Acceptance
        const totalScore = (distScore * 0.4) + (ratingScore * 0.4) + (acceptanceScore * 0.2);
        
        scoredDrivers.push({ id: driverId, score: totalScore });
      }
    }

    if (scoredDrivers.length === 0) return null;

    // 3. Sort by score descending and return the best
    scoredDrivers.sort((a, b) => b.score - a.score);
    
    this.logger.log(`Best driver found: ${scoredDrivers[0].id} with score ${scoredDrivers[0].score.toFixed(3)}`);
    return scoredDrivers[0].id;
  }

  async assignDriver(rideId: string, driverId: string) {
    await this.rideRepository.update(rideId, {
      driver: { id: driverId },
      status: RideStatus.DRIVER_ASSIGNED,
    });

    await this.driverRepository.update(driverId, {
      status: DriverStatus.BUSY,
    });

    this.logger.log(`Ride ${rideId} assigned to driver ${driverId}`);
  }
}
