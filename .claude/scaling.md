# Scaling Strategy

## Phase 1 (MVP)
- Monolith NestJS
- Redis for GEO queries
- WebSockets

## Phase 2
- Split services:
  - Dispatch
  - Location
  - Ride

## Phase 3
- Kafka
- Geo-sharding
- Multi-region deployment

## Key Load

- Driver updates every 3–5 seconds
- WebSocket connections
