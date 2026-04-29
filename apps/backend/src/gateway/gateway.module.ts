import { Module } from '@nestjs/common';
import { LocationGateway } from './location.gateway';
import { SessionsModule } from '../sessions/sessions.module';
import { RidesModule } from '../rides/rides.module';
import { DispatchModule } from '../dispatch/dispatch.module';

@Module({
  imports: [SessionsModule, RidesModule, DispatchModule],
  providers: [LocationGateway],
  exports: [LocationGateway],
})
export class GatewayModule {}
