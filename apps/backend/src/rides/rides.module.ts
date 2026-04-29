import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RidesService } from './rides.service';
import { RidesController } from './rides.controller';
import { RidesGateway } from './rides.gateway';
import { Ride } from './entities/ride.entity';
import { User } from '../users/entities/user.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { LocationModule } from '../location/location.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ride, User, Driver]),
    LocationModule,
  ],
  controllers: [RidesController],
  providers: [RidesService, RidesGateway],
  exports: [RidesService],
})
export class RidesModule {}
