import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, OnGatewayConnection,
  OnGatewayDisconnect, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SessionsService } from '../sessions/sessions.service';
import { SessionStatus } from '../sessions/entities/location-session.entity';

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

  constructor(private readonly sessionsService: SessionsService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.rooms.forEach((members, code) => {
      members.forEach((member, memberId) => {
        if (member.socketId === client.id) {
          members.delete(memberId);
          this.server.to(code).emit('member-left', { memberId });
        }
      });
    });
  }

  // ── Viewer joins a session room to receive updates ──────────────────────
  @SubscribeMessage('join')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() code: string) {
    client.join(code);
    client.emit('joined', { code, timestamp: Date.now() });
    this.logger.log(`${client.id} joined room ${code}`);
  }

  @SubscribeMessage('leave')
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() code: string) {
    client.leave(code);
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
}
