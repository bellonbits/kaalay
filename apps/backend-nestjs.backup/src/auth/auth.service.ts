import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
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

  async findByIdentifier(identifier: string): Promise<User | null> {
    const isEmail = identifier.includes('@');
    if (isEmail) {
      return this.userRepository.findOne({ where: { email: identifier } });
    }
    return this.userRepository.findOne({ where: { phoneNumber: identifier } });
  }

  async requestOtp(phoneNumber: string) {
    console.log(`[AUTH] Sending OTP to ${phoneNumber}: 0000`);
    return { success: true, message: 'OTP sent successfully' };
  }

  async verifyOtp(identifier: string, code: string) {
    console.log(`[AUTH] Verifying identifier: "${identifier}", code: "${code}"`);
    if (code !== '0000' && code !== '1234') {
      console.log(`[AUTH] Code mismatch: "${code}" is not "0000" or "1234"`);
      throw new UnauthorizedException('Invalid code');
    }

    let user = await this.findByIdentifier(identifier);
    let isNewUser = false;

    if (!user) {
      const isEmail = identifier.includes('@');
      user = this.userRepository.create({ 
        phoneNumber: isEmail ? `email-${Date.now()}` : identifier, 
        email: isEmail ? identifier : null,
        role: UserRole.RIDER 
      });
      user = await this.userRepository.save(user);
      isNewUser = true;
    }

    const payload = { identifier, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user,
      isNewUser: isNewUser || !user.fullName,
    };
  }

  async login(phoneNumber: string) {
    const user = await this.findByIdentifier(phoneNumber);
    if (!user) {
      throw new NotFoundException('User not found. Please register first.');
    }

    const payload = { identifier: phoneNumber, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  async register(identifier: string, fullName: string, role: UserRole) {
    let user = await this.findByIdentifier(identifier);
    
    if (user) {
      user.fullName = fullName;
      user.role = role;
      return this.userRepository.save(user);
    }

    const isEmail = identifier.includes('@');
    const newUser = this.userRepository.create({
      phoneNumber: isEmail ? `email-${Date.now()}` : identifier,
      email: isEmail ? identifier : null,
      fullName,
      role,
    });

    return this.userRepository.save(newUser);
  }
}
