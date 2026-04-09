# Dispatch System

## Goal
Match rider with best available driver

## Flow

1. Rider requests ride
2. Convert location → lat/lng
3. Query Redis GEO for nearby drivers
4. Filter:
   - online
   - available
5. Calculate ETA (Google Maps API)
6. Rank drivers
7. Assign best driver
8. Retry if rejected

## Constraints

- <200ms response time
- High reliability
