# Kaalay Haley (Kuja Hapa)

A ride-hailing and logistics platform optimized for Africa, using what3words for precise location.

## Project Structure

- `apps/backend`: NestJS API Gateway and services.
- `apps/frontend`: React + Ant Design web application.
- `.claude/`: Project documentation, architecture, and modular prompts.

## Core Features

- **Precise Location**: Integration with what3words for accurate pickup/drop-off.
- **Real-time Tracking**: Socket.IO for driver and ride updates.
- **Intelligent Dispatch**: Redis-based GEO queries for matching drivers.
- **Hybrid Mobile**: Capacitor-powered mobile apps for Rider and Driver.
- **Offline Payments**: Focus on cash/offline transactions (no in-app payments).

## Tech Stack

- **Backend**: NestJS, PostgreSQL, Redis, Socket.IO.
- **Frontend**: React, Ant Design, Vite.
- **Mobile**: Capacitor.
- **APIs**: what3words, Google Maps.
