import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { RidesService } from './rides.service';
import { CreateRideDto } from './dto/create-ride.dto';
import { RideStatus } from './entities/ride.entity';

@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post()
  create(@Body() createRideDto: CreateRideDto) {
    return this.ridesService.create(createRideDto);
  }

  @Get()
  findAll() {
    return this.ridesService.findAll();
  }

  @Get('rider/:riderId')
  findByRider(@Param('riderId') riderId: string) {
    return this.ridesService.findByRider(riderId);
  }

  @Get('driver/:driverId')
  findByDriver(@Param('driverId') driverId: string) {
    return this.ridesService.findByDriver(driverId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ridesService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: RideStatus }) {
    return this.ridesService.updateStatus(id, body.status);
  }

  @Patch(':id/assign')
  assignDriver(@Param('id') id: string, @Body() body: { driverId: string }) {
    return this.ridesService.assignDriver(id, body.driverId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ridesService.remove(id);
  }
}
