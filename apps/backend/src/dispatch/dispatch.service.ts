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

    // 2. Filter for available drivers in Database
    // nearby is an array of [id, distance, [lng, lat]]
    for (const [driverId] of nearby as [string, ...unknown[]][]) {
      const driver = await this.driverRepository.findOne({
        where: { id: driverId as string, status: DriverStatus.ONLINE },
      });

      if (driver) {
        this.logger.log(`Found available driver: ${driver.id}`);
        return driver.id; // Return the first (closest) available driver
      }
    }

    return null;
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
