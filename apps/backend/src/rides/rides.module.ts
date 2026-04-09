import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RidesService } from './rides.service';
import { RidesController } from './rides.controller';
import { RidesGateway } from './rides.gateway';
import { Ride } from './entities/ride.entity';
import { User } from '../users/entities/user.entity';
import { LocationModule } from '../location/location.module';
import { DispatchModule } from '../dispatch/dispatch.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ride, User]),
    LocationModule,
    DispatchModule,
  ],
  controllers: [RidesController],
  providers: [RidesService, RidesGateway],
})
export class RidesModule {}
