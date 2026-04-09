import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum SessionStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  ENDED = 'ended',
}

export enum SessionVisibility {
  PRIVATE = 'private',
  LINK = 'link',
  PUBLIC = 'public',
}

export enum RequestType {
  GENERAL = 'general',
  LOST = 'lost',
  PICKUP = 'pickup',
  MEETUP = 'meetup',
}

@Entity('location_sessions')
export class LocationSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column('decimal', { precision: 10, scale: 7, default: 0 })
  latitude: number;

  @Column('decimal', { precision: 10, scale: 7, default: 0 })
  longitude: number;

  @Column({ nullable: true })
  accuracy: number;

  @Column({ unique: true, length: 10 })
  shareCode: string;

  @Column({
    type: 'enum',
    enum: RequestType,
    default: RequestType.GENERAL,
  })
  requestType: RequestType;

  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.ACTIVE,
  })
  status: SessionStatus;

  @Column({
    type: 'enum',
    enum: SessionVisibility,
    default: SessionVisibility.LINK,
  })
  visibility: SessionVisibility;

  @Column({ nullable: true })
  message: string;

  @Column({ nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
