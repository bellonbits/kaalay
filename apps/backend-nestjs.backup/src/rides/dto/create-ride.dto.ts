import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CreateRideDto {
  @IsString()
  @IsNotEmpty()
  riderId: string;

  @IsString()
  @IsNotEmpty()
  pickupWhat3words: string;

  @IsNumber()
  @IsOptional()
  pickupLat?: number;

  @IsNumber()
  @IsOptional()
  pickupLng?: number;

  @IsString()
  @IsNotEmpty()
  destinationWhat3words: string;

  @IsNumber()
  @IsOptional()
  destinationLat?: number;

  @IsNumber()
  @IsOptional()
  destinationLng?: number;
}
