import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRideDto } from './dto/create-ride.dto';
import { Ride, RideStatus } from './entities/ride.entity';
import { User } from '../users/entities/user.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { LocationService } from '../location/location.service';

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);

  constructor(
    @InjectRepository(Ride)   private rideRepository:   Repository<Ride>,
    @InjectRepository(User)   private userRepository:   Repository<User>,
    @InjectRepository(Driver) private driverRepository: Repository<Driver>,
    private locationService: LocationService,
  ) {}

  private calculateFare(pickupLat: number, pickupLng: number, destLat: number, destLng: number): number {
    const R = 6371;
    const dL = (destLat - pickupLat) * Math.PI / 180;
    const dG = (destLng - pickupLng) * Math.PI / 180;
    const a = Math.sin(dL / 2) ** 2 + Math.cos(pickupLat * Math.PI / 180) * Math.cos(destLat * Math.PI / 180) * Math.sin(dG / 2) ** 2;
    const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round((50 + distKm * 50) / 10) * 10; // KES, rounded to nearest 10
  }

  async create(createRideDto: CreateRideDto): Promise<Ride> {
    const { riderId, pickupWhat3words, destinationWhat3words } = createRideDto;

    const rider = await this.userRepository.findOne({ where: { id: riderId } });
    if (!rider) throw new NotFoundException('Rider not found');

    let pickupLat = createRideDto.pickupLat;
    let pickupLng = createRideDto.pickupLng;
    if (!pickupLat || !pickupLng) {
      const loc = await this.locationService.convertToCoordinates(pickupWhat3words);
      pickupLat = loc.latitude;
      pickupLng = loc.longitude;
    }

    let destLat = createRideDto.destinationLat;
    let destLng = createRideDto.destinationLng;
    if (!destLat || !destLng) {
      const loc = await this.locationService.convertToCoordinates(destinationWhat3words);
      destLat = loc.latitude;
      destLng = loc.longitude;
    }

    const fare = this.calculateFare(pickupLat, pickupLng, destLat, destLng);

    const ride = this.rideRepository.create({
      rider,
      pickupLat,
      pickupLng,
      pickupWhat3words,
      destinationLat: destLat,
      destinationLng: destLng,
      destinationWhat3words,
      fare,
      status: RideStatus.REQUESTED,
    });

    return this.rideRepository.save(ride);
  }

  async assignDriver(rideId: string, driverId: string): Promise<Ride> {
    const driver = await this.driverRepository.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');

    await this.rideRepository.update(rideId, {
      driver,
      status: RideStatus.DRIVER_ASSIGNED,
    });
    await this.driverRepository.update(driverId, { status: 'busy' as any });
    return this.findOne(rideId);
  }

  async updateStatus(id: string, status: RideStatus): Promise<Ride> {
    await this.rideRepository.update(id, { status });
    if (status === RideStatus.COMPLETED || status === RideStatus.CANCELLED) {
      const ride = await this.findOne(id);
      if (ride.driver?.id) {
        await this.driverRepository.update(ride.driver.id, { status: 'online' as any });
      }
    }
    return this.findOne(id);
  }

  findAll() {
    return this.rideRepository.find({ relations: ['rider', 'driver', 'driver.user'] });
  }

  async findOne(id: string): Promise<Ride> {
    const ride = await this.rideRepository.findOne({
      where: { id },
      relations: ['rider', 'driver', 'driver.user'],
    });
    if (!ride) throw new NotFoundException('Ride not found');
    return ride;
  }

  async findByRider(riderId: string): Promise<Ride[]> {
    return this.rideRepository.find({
      where: { rider: { id: riderId } },
      relations: ['rider', 'driver', 'driver.user'],
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  async findByDriver(driverId: string): Promise<Ride[]> {
    return this.rideRepository.find({
      where: { driver: { id: driverId } },
      relations: ['rider', 'driver', 'driver.user'],
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  async remove(id: string) {
    await this.rideRepository.delete(id);
    return { deleted: true };
  }
}
