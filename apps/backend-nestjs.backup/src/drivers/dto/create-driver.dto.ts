import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateDriverDto {
  @IsUUID()
  userId: string;

  @IsString() @IsNotEmpty()
  vehicleModel: string;

  @IsString() @IsNotEmpty()
  vehicleColor: string;

  @IsString() @IsNotEmpty()
  licensePlate: string;
}
