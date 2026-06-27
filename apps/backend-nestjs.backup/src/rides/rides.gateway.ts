import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RidesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RidesGateway.name);
  private readonly DRIVER_LOCATIONS_KEY = 'driver_locations';

  constructor(private redisService: RedisService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('driver:update_location')
  async handleLocationUpdate(
    @MessageBody() data: { driverId: string; lat: number; lng: number },
    @ConnectedSocket() client: Socket,
  ) {
    const { driverId, lat, lng } = data;
    this.logger.log(`Location update from driver ${driverId}: ${lat}, ${lng}`);

    // 1. Update Redis GEO
    await this.redisService.updateLocation(this.DRIVER_LOCATIONS_KEY, driverId, lat, lng);

    // 2. Broadcast to all interested clients (e.g. riders in that area)
    // For now, we broadcast globally to simplify, but in prod we'd room-base it
    this.server.emit('driver:location_changed', { driverId, lat, lng });
  }

  @SubscribeMessage('ride:request')
  handleRideRequest(@MessageBody() data: any) {
    this.logger.log(`New ride request: ${JSON.stringify(data)}`);
    // Logic to notify dispatch or nearby drivers
  }
}
