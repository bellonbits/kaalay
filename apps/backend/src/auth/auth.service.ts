import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async validateUserByPhoneNumber(phoneNumber: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { phoneNumber } });
  }

  async login(phoneNumber: string) {
    let user = await this.validateUserByPhoneNumber(phoneNumber);

    if (!user) {
      // For simplicity in this demo, we auto-register if not found
      user = await this.register(phoneNumber);
    }

    const payload = { phoneNumber: user.phoneNumber, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  async register(phoneNumber: string, fullName?: string, role: UserRole = UserRole.RIDER) {
    const existingUser = await this.userRepository.findOne({ where: { phoneNumber } });
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const newUser = this.userRepository.create({
      phoneNumber,
      fullName,
      role,
    });

    return this.userRepository.save(newUser);
  }
}
