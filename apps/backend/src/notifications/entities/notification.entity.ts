import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  title: string;

  @Column()
  message: string;

  @Column({ default: 'info' })
  type: string; // 'info', 'success', 'warning', 'error'

  @Column({ default: false })
  read: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
