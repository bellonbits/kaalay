# Backend Design (NestJS)

## Modules

- auth/
- users/
- drivers/
- rides/
- location/
- dispatch/
- notifications/

## Ride Lifecycle

- REQUESTED
- DRIVER_ASSIGNED
- DRIVER_ARRIVING
- IN_PROGRESS
- COMPLETED
- CANCELLED

## Core Services

### RideService
- createRide()
- cancelRide()
- acceptRide()
- startRide()
- completeRide()

### LocationService
- updateDriverLocation()
- getNearbyDrivers()

### DispatchService
- findBestDriver()
- assignDriver()

## Realtime Events

- driver:location:update
- ride:request
- ride:assigned
- ride:started
- ride:completed
- ride:cancelled
