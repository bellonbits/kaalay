import { IsEnum, IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';
import { RequestType, SessionVisibility } from '../entities/location-session.entity';

export class CreateSessionDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @IsOptional()
  @IsEnum(RequestType)
  requestType?: RequestType;

  @IsOptional()
  @IsEnum(SessionVisibility)
  visibility?: SessionVisibility;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
