import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Driver } from '../../drivers/entities/driver.entity';

export enum RideStatus {
  REQUESTED = 'requested',
  DRIVER_ASSIGNED = 'driver_assigned',
  DRIVER_ARRIVING = 'driver_arriving',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('rides')
export class Ride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.rides)
  rider: User;

  @ManyToOne(() => Driver, (driver) => driver.rides, { nullable: true })
  driver: Driver;

  // Pickup Location
  @Column({ type: 'float' })
  pickupLat: number;

  @Column({ type: 'float' })
  pickupLng: number;

  @Column()
  pickupWhat3words: string;

  // Destination Location
  @Column({ type: 'float' })
  destinationLat: number;

  @Column({ type: 'float' })
  destinationLng: number;

  @Column()
  destinationWhat3words: string;

  @Column({
    type: 'enum',
    enum: RideStatus,
    default: RideStatus.REQUESTED,
  })
  status: RideStatus;

  @Column({ type: 'float', nullable: true })
  fare: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
