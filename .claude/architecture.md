# Architecture Overview

## Services

- API Gateway (NestJS)
- Auth Service
- User Service
- Driver Service
- Ride Service
- Location Service
- Dispatch Service
- Notification Service

## Realtime
- WebSockets (Socket.IO)

## Data Layer
- PostgreSQL (persistent data)
- Redis (real-time + GEO queries)

## External APIs
- Google Maps API
- what3words API

## Deployment
- Frontend → Vercel
- Backend → Docker (Railway/Render)
