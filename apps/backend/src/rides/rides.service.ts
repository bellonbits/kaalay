import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRideDto } from './dto/create-ride.dto';
import { UpdateRideDto } from './dto/update-ride.dto';
import { Ride, RideStatus } from './entities/ride.entity';
import { User } from '../users/entities/user.entity';
import { LocationService } from '../location/location.service';
import { DispatchService } from '../dispatch/dispatch.service';

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);

  constructor(
    @InjectRepository(Ride)
    private rideRepository: Repository<Ride>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private locationService: LocationService,
    private dispatchService: DispatchService,
  ) {}

  async create(createRideDto: CreateRideDto): Promise<Ride> {
    const { riderId, pickupWhat3words, destinationWhat3words } = createRideDto;

    // 1. Verify Rider
    const rider = await this.userRepository.findOne({ where: { id: riderId } });
    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    // 2. Resolve Coordinates if missing
    let pickupLat = createRideDto.pickupLat;
    let pickupLng = createRideDto.pickupLng;
    if (!pickupLat || !pickupLng) {
      this.logger.log(`Resolving pickup coordinates for ${pickupWhat3words}`);
      const loc = await this.locationService.convertToCoordinates(pickupWhat3words);
      pickupLat = loc.latitude;
      pickupLng = loc.longitude;
    }

    let destLat = createRideDto.destinationLat;
    let destLng = createRideDto.destinationLng;
    if (!destLat || !destLng) {
      this.logger.log(`Resolving destination coordinates for ${destinationWhat3words}`);
      const loc = await this.locationService.convertToCoordinates(destinationWhat3words);
      destLat = loc.latitude;
      destLng = loc.longitude;
    }

    // 3. Create Ride Record
    const ride = this.rideRepository.create({
      rider,
      pickupLat,
      pickupLng,
      pickupWhat3words,
      destinationLat: destLat,
      destinationLng: destLng,
      destinationWhat3words,
      status: RideStatus.REQUESTED,
    });

    const savedRide = await this.rideRepository.save(ride);

    // 4. Trigger Dispatch (Fire and Forget or handle async)
    this.triggerDispatch(savedRide.id, pickupLat, pickupLng);

    return savedRide;
  }

  private async triggerDispatch(rideId: string, lat: number, lng: number) {
    try {
      this.logger.log(`Triggering dispatch for ride ${rideId}`);
      const driverId = await this.dispatchService.findBestDriver(lat, lng);
      
      if (driverId) {
        await this.dispatchService.assignDriver(rideId, driverId);
      } else {
        this.logger.warn(`No driver found for ride ${rideId}`);
      }
    } catch (error) {
      this.logger.error(`Error in dispatch for ride ${rideId}: ${error.message}`);
    }
  }

  findAll() {
    return this.rideRepository.find({ relations: ['rider', 'driver'] });
  }

  async findOne(id: string) {
    const ride = await this.rideRepository.findOne({
      where: { id },
      relations: ['rider', 'driver'],
    });
    if (!ride) throw new NotFoundException('Ride not found');
    return ride;
  }

  async update(id: string, updateRideDto: UpdateRideDto) {
    await this.rideRepository.update(id, updateRideDto);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.rideRepository.delete(id);
    return { deleted: true };
  }
}
