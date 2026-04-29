import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { DriverStatus } from './entities/driver.entity';

@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post()
  register(@Body() dto: CreateDriverDto) {
    return this.driversService.register(dto);
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.driversService.findByUserId(userId);
  }

  @Get('online')
  findOnline() {
    return this.driversService.findOnline();
  }

  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() body: { status: DriverStatus }) {
    return this.driversService.setStatus(id, body.status);
  }
}
