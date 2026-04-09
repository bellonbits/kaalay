import {
  Controller, Post, Get, Patch, Body, Param, Req,
  UseGuards,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SessionStatus } from './entities/location-session.entity';

// Simple JWT guard placeholder — replace with real AuthGuard('jwt') when auth is wired
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  /** POST /sessions — create a new location session */
  @Post()
  create(@Body() dto: CreateSessionDto, @Req() req: any) {
    // userId from JWT; fallback to body for dev
    const userId = req.user?.id ?? dto['userId'] ?? 'anonymous';
    return this.sessionsService.create(userId, dto);
  }

  /** GET /sessions/public — list active public sessions */
  @Get('public')
  findPublic() {
    return this.sessionsService.findActivePublic();
  }

  /** GET /sessions/code/:code — look up by share code */
  @Get('code/:code')
  findByCode(@Param('code') code: string) {
    return this.sessionsService.findByCode(code);
  }

  /** GET /sessions/user/:userId */
  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.sessionsService.findByUser(userId);
  }

  /** PATCH /sessions/:code/location */
  @Patch(':code/location')
  updateLocation(
    @Param('code') code: string,
    @Body() body: { lat: number; lng: number; accuracy?: number },
  ) {
    return this.sessionsService.updateLocation(code, body.lat, body.lng, body.accuracy);
  }

  /** PATCH /sessions/:code/status */
  @Patch(':code/status')
  updateStatus(
    @Param('code') code: string,
    @Body() body: { status: SessionStatus },
  ) {
    return this.sessionsService.updateStatus(code, body.status);
  }
}
