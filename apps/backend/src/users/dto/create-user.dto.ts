import { IsString, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @IsString()
  fullName: string;

  @IsString()
  phoneNumber: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
