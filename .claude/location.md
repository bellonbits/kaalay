# Location System (Core Feature)

## Input Methods

1. GPS (current location)
2. Map pin (manual selection)
3. what3words input

## Unified Model

{
  latitude: number,
  longitude: number,
  what3words: string,
  source: 'gps' | 'pin' | 'what3words'
}

## Flow

GPS/Pin → lat/lng → what3words  
what3words → lat/lng  

## Storage

PostgreSQL:
- latitude
- longitude
- what3words

Redis:
- driver_id → GEO location

## Purpose

- Accurate pickup
- Better dispatch
- Solves African addressing problem
