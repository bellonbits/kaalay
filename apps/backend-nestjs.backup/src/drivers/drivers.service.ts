import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver, DriverStatus } from './entities/driver.entity';
import { User } from '../users/entities/user.entity';
import { CreateDriverDto } from './dto/create-driver.dto';

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver) private driverRepo: Repository<Driver>,
    @InjectRepository(User)   private userRepo:   Repository<User>,
  ) {}

  async register(dto: CreateDriverDto): Promise<Driver> {
    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.driverRepo.findOne({ where: { user: { id: dto.userId } }, relations: ['user'] });
    if (existing) return existing;

    const driver = this.driverRepo.create({
      user,
      vehicleModel: dto.vehicleModel,
      vehicleColor: dto.vehicleColor,
      licensePlate: dto.licensePlate,
    });
    return this.driverRepo.save(driver);
  }

  async findByUserId(userId: string): Promise<Driver | null> {
    return this.driverRepo.findOne({ where: { user: { id: userId } }, relations: ['user'] });
  }

  async findById(id: string): Promise<Driver | null> {
    return this.driverRepo.findOne({ where: { id }, relations: ['user'] });
  }

  async setStatus(driverId: string, status: DriverStatus): Promise<Driver> {
    await this.driverRepo.update(driverId, { status });
    const driver = await this.findById(driverId);
    if (!driver) throw new NotFoundException('Driver not found');
    return driver;
  }

  async findOnline(): Promise<Driver[]> {
    return this.driverRepo.find({ where: { status: DriverStatus.ONLINE }, relations: ['user'] });
  }
}
