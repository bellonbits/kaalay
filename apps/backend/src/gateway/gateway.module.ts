import { Module } from '@nestjs/common';
import { LocationGateway } from './location.gateway';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [SessionsModule],
  providers: [LocationGateway],
  exports: [LocationGateway],
})
export class GatewayModule {}
