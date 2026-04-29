import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, OnGatewayConnection,
  OnGatewayDisconnect, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SessionsService } from '../sessions/sessions.service';
import { SessionStatus } from '../sessions/entities/location-session.entity';
import { RideStatus } from '../rides/entities/ride.entity';
import { RidesService } from '../rides/rides.service';
import { DispatchService } from '../dispatch/dispatch.service';

export interface GroupMember {
  memberId: string;
  name: string;
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  lastSeen: number;
  socketId: string;
}

export interface LocationPayload {
  code: string;
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  timestamp?: number;
}

export interface RequestPayload {
  code: string;
  type: string;     // lost | pickup | meetup | general
  message?: string;
  lat: number;
  lng: number;
  userName?: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/loc',
})
export class LocationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LocationGateway.name);
  private readonly rooms = new Map<string, Map<string, GroupMember>>();
  private readonly viewers = new Map<string, Set<string>>(); // code → set of socket IDs

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly ridesService: RidesService,
    private readonly dispatchService: DispatchService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Clean up group rooms
    this.rooms.forEach((members, code) => {
      members.forEach((member, memberId) => {
        if (member.socketId === client.id) {
          members.delete(memberId);
          this.server.to(code).emit('member-left', { memberId });
        }
      });
    });
    // Clean up viewer counts
    this.viewers.forEach((sockets, code) => {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        this.server.to(code).emit('viewer-count', { count: sockets.size });
      }
    });
  }

  // ── Viewer joins a session room to receive updates ──────────────────────
  @SubscribeMessage('join')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() code: string) {
    client.join(code);
    if (!this.viewers.has(code)) this.viewers.set(code, new Set());
    this.viewers.get(code)!.add(client.id);
    const viewerCount = this.viewers.get(code)!.size;
    client.emit('joined', { code, timestamp: Date.now() });
    // Notify broadcaster of updated viewer count
    this.server.to(code).emit('viewer-count', { count: viewerCount });
    this.logger.log(`${client.id} joined room ${code} (${viewerCount} viewers)`);
  }

  @SubscribeMessage('leave')
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() code: string) {
    client.leave(code);
    this.viewers.get(code)?.delete(client.id);
    const viewerCount = this.viewers.get(code)?.size ?? 0;
    this.server.to(code).emit('viewer-count', { count: viewerCount });
  }

  // ── Owner pushes live location ───────────────────────────────────────────
  @SubscribeMessage('push-location')
  async handlePushLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LocationPayload,
  ) {
    const { code, lat, lng, accuracy, heading, timestamp } = payload;

    // Persist to DB (non-blocking)
    this.sessionsService.updateLocation(code, lat, lng, accuracy).catch(() => null);

    // Broadcast to all viewers in room (including sender for multi-device)
    this.server.to(code).emit('location', {
      lat, lng, accuracy, heading,
      timestamp: timestamp ?? Date.now(),
    });
  }

  // ── Owner changes session status (pause / end) ───────────────────────────
  @SubscribeMessage('set-status')
  async handleSetStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { code: string; status: SessionStatus },
  ) {
    await this.sessionsService.updateStatus(payload.code, payload.status).catch(() => null);
    this.server.to(payload.code).emit('status', { status: payload.status });
  }

  // ── Broadcast a help request to all helpers watching /requests ──────────
  @SubscribeMessage('new-request')
  handleNewRequest(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: RequestPayload,
  ) {
    // Broadcast to the global "requests" room (helpers subscribe to it)
    this.server.to('__requests__').emit('request', payload);
    this.logger.log(`New ${payload.type} request: ${payload.code}`);
  }

  // ── Helper subscribes to nearby requests feed ───────────────────────────
  @SubscribeMessage('watch-requests')
  handleWatchRequests(@ConnectedSocket() client: Socket) {
    client.join('__requests__');
    client.emit('watching-requests', { ok: true });
  }

  // ── Helper accepts a request ─────────────────────────────────────────────
  @SubscribeMessage('accept-request')
  handleAcceptRequest(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: { code: string; helperName: string; helperId: string },
  ) {
    this.server.to(payload.code).emit('request-accepted', {
      helperName: payload.helperName,
      helperId: payload.helperId,
      timestamp: Date.now(),
    });
  }

  // ── Group session: join room and register member ──────────────────────────
  @SubscribeMessage('join-group')
  handleJoinGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { code: string; memberId: string; name: string; lat: number; lng: number; accuracy?: number; heading?: number },
  ) {
    const { code, memberId, name, lat, lng, accuracy, heading } = payload;
    client.join(code);
    if (!this.rooms.has(code)) this.rooms.set(code, new Map());
    const member: GroupMember = { memberId, name, lat, lng, accuracy, heading, lastSeen: Date.now(), socketId: client.id };
    this.rooms.get(code)!.set(memberId, member);
    client.emit('member-list', Array.from(this.rooms.get(code)!.values()));
    client.to(code).emit('member-joined', member);
    this.logger.log(`${name} joined group ${code}`);
  }

  // ── Group session: push location update tagged with memberId ─────────────
  @SubscribeMessage('group-location')
  handleGroupLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { code: string; memberId: string; lat: number; lng: number; accuracy?: number; heading?: number },
  ) {
    const { code, memberId } = payload;
    const room = this.rooms.get(code);
    if (room?.has(memberId)) {
      const existing = room.get(memberId)!;
      room.set(memberId, { ...existing, ...payload, lastSeen: Date.now() });
    }
    client.to(code).emit('member-location', { ...payload, timestamp: Date.now() });
  }

  // ── Group session: member leaves ─────────────────────────────────────────
  @SubscribeMessage('leave-group')
  handleLeaveGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { code: string; memberId: string },
  ) {
    const { code, memberId } = payload;
    client.leave(code);
    this.rooms.get(code)?.delete(memberId);
    this.server.to(code).emit('member-left', { memberId });
  }

  // ── Group session: set meeting point destination ──────────────────────────
  @SubscribeMessage('set-destination')
  handleSetDestination(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: { code: string; lat: number; lng: number; label?: string },
  ) {
    this.server.to(payload.code).emit('destination', payload);
  }

  // ── Viewer pushes own location back to the broadcaster ───────────────────
  @SubscribeMessage('viewer-location')
  handleViewerLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { code: string; viewerId: string; name: string; lat: number; lng: number; accuracy?: number },
  ) {
    // Broadcast viewer position to everyone else in the room (broadcaster sees you coming)
    client.to(payload.code).emit('viewer-location', { ...payload, timestamp: Date.now() });
  }

  // ── Viewer signals they have arrived ─────────────────────────────────────
  @SubscribeMessage('arrived')
  handleArrived(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: { code: string; name: string },
  ) {
    this.server.to(payload.code).emit('member-arrived', {
      name: payload.name,
      timestamp: Date.now(),
    });
    this.logger.log(`${payload.name} arrived at session ${payload.code}`);
  }

  // ── Ride: driver goes online / offline ────────────────────────────────────
  @SubscribeMessage('driver:online')
  handleDriverOnline(@ConnectedSocket() client: Socket, @MessageBody() payload: { driverId: string }) {
    client.join('__drivers__');
    if (payload.driverId) client.join(`driver:${payload.driverId}`);
  }

  @SubscribeMessage('driver:offline')
  handleDriverOffline(@ConnectedSocket() client: Socket, @MessageBody() _payload: { driverId: string }) {
    client.leave('__drivers__');
  }

  // ── Ride: rider broadcasts a new ride request to all online drivers ────────
  @SubscribeMessage('ride:request')
  async handleRideRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: {
      rideId: string; pickupW3W: string; destW3W: string;
      pickupLat: number; pickupLng: number; destLat: number; destLng: number;
      riderName: string; fare: number;
    },
  ) {
    client.join(`ride:${payload.rideId}`);
    this.logger.log(`Ride request received: ${payload.rideId}. Finding best driver...`);

    // 1. Find the best driver
    const bestDriverId = await this.dispatchService.findBestDriver(payload.pickupLat, payload.pickupLng);

    if (bestDriverId) {
      this.logger.log(`Targeting driver ${bestDriverId} for ride ${payload.rideId}`);
      // In a real app, we might send ONLY to this driver first.
      // For now, we'll notify all drivers but tag the best one, or just emit to the best one's private room.
      // Let's assume each driver is in a room named `driver:${driverId}`
      this.server.to(`driver:${bestDriverId}`).emit('ride:new', { ...payload, isTargeted: true });
    }

    // Fallback: Also broadcast to the general drivers pool if no "best" found or just to be safe
    this.server.to('__drivers__').emit('ride:new', payload);
  }

  // ── Ride: rider joins their ride room (for receiving driver updates) ───────
  @SubscribeMessage('ride:join')
  handleRideJoin(@ConnectedSocket() client: Socket, @MessageBody() payload: { rideId: string }) {
    client.join(`ride:${payload.rideId}`);
  }

  // ── Ride: driver accepts a ride ───────────────────────────────────────────
  @SubscribeMessage('ride:accept')
  async handleRideAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: {
      rideId: string; driverId: string;
      driverName: string; vehicleModel: string; vehicleColor: string; licensePlate: string;
    },
  ) {
    await this.ridesService.assignDriver(payload.rideId, payload.driverId).catch(() => null);
    client.join(`ride:${payload.rideId}`);
    this.server.to(`ride:${payload.rideId}`).emit('ride:accepted', {
      driverName: payload.driverName,
      vehicleModel: payload.vehicleModel,
      vehicleColor: payload.vehicleColor,
      licensePlate: payload.licensePlate,
    });
    // Tell other drivers this ride is taken
    this.server.to('__drivers__').emit('ride:taken', { rideId: payload.rideId });
    this.logger.log(`Ride ${payload.rideId} accepted by driver ${payload.driverId}`);
  }

  // ── Ride: driver is on the way ────────────────────────────────────────────
  @SubscribeMessage('ride:arriving')
  async handleRideArriving(@ConnectedSocket() _c: Socket, @MessageBody() payload: { rideId: string }) {
    await this.ridesService.updateStatus(payload.rideId, RideStatus.DRIVER_ARRIVING).catch(() => null);
    this.server.to(`ride:${payload.rideId}`).emit('ride:status', { status: RideStatus.DRIVER_ARRIVING });
  }

  // ── Ride: rider picked up, trip starts ────────────────────────────────────
  @SubscribeMessage('ride:pickup')
  async handleRidePickup(@ConnectedSocket() _c: Socket, @MessageBody() payload: { rideId: string }) {
    await this.ridesService.updateStatus(payload.rideId, RideStatus.IN_PROGRESS).catch(() => null);
    this.server.to(`ride:${payload.rideId}`).emit('ride:status', { status: RideStatus.IN_PROGRESS });
  }

  // ── Ride: trip complete ───────────────────────────────────────────────────
  @SubscribeMessage('ride:complete')
  async handleRideComplete(@ConnectedSocket() _c: Socket, @MessageBody() payload: { rideId: string }) {
    await this.ridesService.updateStatus(payload.rideId, RideStatus.COMPLETED).catch(() => null);
    this.server.to(`ride:${payload.rideId}`).emit('ride:status', { status: RideStatus.COMPLETED });
  }

  // ── Ride: driver streams live location to rider ───────────────────────────
  @SubscribeMessage('ride:driver_location')
  handleRideDriverLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { rideId: string; lat: number; lng: number; heading?: number },
  ) {
    client.to(`ride:${payload.rideId}`).emit('ride:driver_location', payload);
  }
}
