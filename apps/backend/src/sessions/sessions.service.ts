import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocationSession, SessionStatus } from './entities/location-session.entity';
import { CreateSessionDto } from './dto/create-session.dto';

function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'KAA-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(LocationSession)
    private sessionRepo: Repository<LocationSession>,
  ) {}

  async create(userId: string | null, dto: CreateSessionDto): Promise<LocationSession> {
    let shareCode: string;
    let attempts = 0;
    do {
      shareCode = generateShareCode();
      attempts++;
      if (attempts > 10) throw new Error('Could not generate unique share code');
    } while (await this.sessionRepo.findOne({ where: { shareCode } }));

    const session = this.sessionRepo.create({
      userId,
      ...dto,
      shareCode,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });
    return this.sessionRepo.save(session);
  }

  async findByCode(code: string): Promise<LocationSession> {
    const session = await this.sessionRepo.findOne({
      where: { shareCode: code },
      relations: ['user'],
    });
    if (!session) throw new NotFoundException(`Session ${code} not found`);
    return session;
  }

  async findActivePublic(): Promise<LocationSession[]> {
    return this.sessionRepo.find({
      where: { status: SessionStatus.ACTIVE, visibility: 'public' as any },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async findByUser(userId: string): Promise<LocationSession[]> {
    return this.sessionRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  async updateLocation(
    code: string,
    lat: number,
    lng: number,
    accuracy?: number,
  ): Promise<LocationSession> {
    const session = await this.findByCode(code);
    session.latitude = lat;
    session.longitude = lng;
    if (accuracy !== undefined) session.accuracy = accuracy;
    return this.sessionRepo.save(session);
  }

  async updateStatus(code: string, status: SessionStatus): Promise<LocationSession> {
    const session = await this.findByCode(code);
    session.status = status;
    return this.sessionRepo.save(session);
  }

  async endExpired(): Promise<void> {
    await this.sessionRepo
      .createQueryBuilder()
      .update(LocationSession)
      .set({ status: SessionStatus.ENDED })
      .where('expiresAt < NOW() AND status = :s', { s: SessionStatus.ACTIVE })
      .execute();
  }
}
