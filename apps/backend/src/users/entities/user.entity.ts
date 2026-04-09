import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Ride } from '../../rides/entities/ride.entity';

export enum UserRole {
  USER = 'user',
  HELPER = 'helper',   // can accept requests / assist lost people
  DRIVER = 'driver',
  ADMIN = 'admin',
  // legacy alias
  RIDER = 'rider',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  phoneNumber: string;

  @Column({ nullable: true })
  fullName: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.RIDER,
  })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Ride, (ride) => ride.rider)
  rides: Ride[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
