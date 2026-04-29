# Kaalay — Ride-Hailing Platform

A ride-hailing and logistics platform optimised for Africa, using what3words for precise location addressing.

---

## Architecture Overview

```mermaid
graph TB
    subgraph Mobile["📱 Mobile App (Capacitor)"]
        direction TB
        OB[Onboarding]
        HS[Home / Map]
        RS[Ride Select]
        FD[Finding Driver]
        DR[Driver Arriving]
        PY[Payment]
        RT[Rating]
        OB --> HS --> RS --> FD --> DR --> RT
        RS --> PY
    end

    subgraph Frontend["🖥️ Frontend — React + Vite"]
        direction TB
        AppRouter[App.tsx — Screen Router]
        MapView[MapView — google-map-react]
        APIClient[api/client.ts — Axios]
        SocketClient[socket.io-client]
        GPS[useGPS — Capacitor Geolocation]
    end

    subgraph Backend["⚙️ Backend — NestJS"]
        direction TB
        AuthMod[Auth Module\nJWT · Phone Login]
        UsersMod[Users Module]
        DriversMod[Drivers Module]
        RidesMod[Rides Module]
        LocationMod[Location Module\nwhat3words API]
        DispatchMod[Dispatch Module\nBest-driver matching]
        WS[WebSocket Gateway\nSocket.IO]
        RedisMod[Redis Module\nGEO queries]
    end

    subgraph Storage["🗄️ Storage"]
        PG[(PostgreSQL\nUsers · Drivers · Rides)]
        RD[(Redis\nDriver GEO locations)]
    end

    subgraph External["🌐 External APIs"]
        W3W[what3words API\nPrecise addressing]
        GM[Google Maps API\nRouting · Geocoding]
    end

    Mobile -->|renders| Frontend
    Frontend -->|HTTP REST| APIClient
    Frontend -->|real-time| SocketClient
    APIClient -->|requests| Backend
    SocketClient <-->|ws| WS

    AuthMod --> UsersMod
    RidesMod --> LocationMod
    RidesMod --> DispatchMod
    DispatchMod --> RedisMod
    WS --> RedisMod

    Backend --> PG
    RedisMod --> RD
    LocationMod -->|HTTPS| W3W
    MapView -->|HTTPS| GM
```

---

## Request Flow — Booking a Ride

```mermaid
sequenceDiagram
    actor Rider
    participant App as React App
    participant API as NestJS API
    participant W3W as what3words
    participant DB as PostgreSQL
    participant Redis
    participant WS as WebSocket
    actor Driver

    Rider->>App: Enter destination
    App->>API: GET /location/convert-to-coordinates?words=xxx
    API->>W3W: Convert w3w → lat/lng
    W3W-->>API: {lat, lng}
    API-->>App: coordinates

    Rider->>App: Tap "Book Taxi"
    App->>API: POST /rides {riderId, pickup, destination}
    API->>DB: Create Ride (status: REQUESTED)
    API->>Redis: GEORADIUS — find nearby drivers
    Redis-->>API: [driverId, distance]
    API->>DB: Update Ride (status: DRIVER_ASSIGNED)
    API->>DB: Update Driver (status: BUSY)
    API-->>App: Ride created

    API->>WS: Emit ride:assigned → Driver
    WS-->>Driver: New ride notification

    loop Every 5s
        Driver->>WS: Emit driver:update_location {lat, lng}
        WS->>Redis: GEOADD driver_locations
        WS-->>App: Emit driver:location_changed
        App-->>Rider: Update driver pin on map
    end

    Driver->>API: PATCH /rides/:id {status: completed}
    API->>DB: Update Ride + Driver status
    API-->>App: Ride completed
    App-->>Rider: Show rating screen
```

---

## Data Model

```mermaid
erDiagram
    USER {
        uuid id PK
        string phoneNumber UK
        string fullName
        enum role "rider | driver | admin"
        bool isActive
        timestamp createdAt
    }

    DRIVER {
        uuid id PK
        uuid userId FK
        string vehicleModel
        string vehicleColor
        string licensePlate UK
        enum status "online | offline | busy"
        float rating
    }

    RIDE {
        uuid id PK
        uuid riderId FK
        uuid driverId FK
        float pickupLat
        float pickupLng
        string pickupWhat3words
        float destinationLat
        float destinationLng
        string destinationWhat3words
        enum status "requested | driver_assigned | driver_arriving | in_progress | completed | cancelled"
        float fare
        timestamp createdAt
    }

    USER ||--o{ RIDE : "books"
    DRIVER ||--o{ RIDE : "fulfils"
    USER ||--o| DRIVER : "registered as"
```

---

## Dispatch Algorithm

```mermaid
flowchart TD
    A([Ride Requested]) --> B[Resolve w3w → lat/lng]
    B --> C[Save Ride\nstatus: REQUESTED]
    C --> D[GEORADIUS on Redis\nradius: 5km]
    D --> E{Drivers found\nnearby?}
    E -->|No| F[Log warning\nNo driver available]
    E -->|Yes| G[Iterate nearest first]
    G --> H{Driver status\n= ONLINE in DB?}
    H -->|No| G
    H -->|Yes| I[Assign Driver\nstatus: DRIVER_ASSIGNED]
    I --> J[Set Driver\nstatus: BUSY]
    J --> K[Emit via WebSocket\nto Driver app]
    K --> L([Driver notified])
    F --> M([Retry or cancel])
```

---

## Screen Flow

```mermaid
stateDiagram-v2
    [*] --> Onboarding
    Onboarding --> Home : Swipe through slides

    Home --> RideSelect : Select destination
    RideSelect --> Home : Back

    RideSelect --> Payment : Tap payment method
    Payment --> RideSelect : Confirm / Back

    RideSelect --> FindingDriver : Book Taxi

    FindingDriver --> Home : Cancel
    FindingDriver --> DriverFound : Driver matched (auto ~5s)

    DriverFound --> Home : Cancel ride
    DriverFound --> Rating : Ride completed (auto ~8s)

    Rating --> Home : Submit & Done
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile shell | Capacitor (iOS + Android) |
| Frontend | React 19, Vite 8, TypeScript |
| UI components | Ant Design 6, @ant-design/icons |
| Maps | google-map-react, Google Maps API |
| Location | what3words API |
| Real-time | Socket.IO (client + server) |
| Backend | NestJS, TypeScript |
| Auth | JWT, phone-number login |
| ORM | TypeORM |
| Database | PostgreSQL 15 |
| Cache / GEO | Redis 7 (GEOADD / GEORADIUS) |
| Infra | Podman Compose |

---

## Project Structure

```
kaalay/
├── docker-compose.yml          # PostgreSQL + Redis + Adminer (Podman Compose)
├── apps/
│   ├── backend/                # NestJS API
│   │   └── src/
│   │       ├── auth/           # JWT · phone login
│   │       ├── users/          # User entity + CRUD
│   │       ├── drivers/        # Driver entity + status
│   │       ├── rides/          # Ride lifecycle + WebSocket gateway
│   │       ├── dispatch/       # GEO-based driver matching
│   │       ├── location/       # what3words integration
│   │       └── redis/          # Redis GEO service
│   └── frontend/               # React + Vite + Capacitor
│       └── src/
│           ├── screens/        # 7 mobile screens
│           ├── components/     # MapView, LocationPicker
│           ├── hooks/          # useGPS
│           └── api/            # Axios client
```

---

## How to Run

### 1. Start Infrastructure (PostgreSQL & Redis)
You need [Podman](https://podman.io/docs/installation) and [podman-compose](https://github.com/containers/podman-compose) installed. Run the following command from the root `kaalay` folder:
```bash
podman-compose up -d
```

### 2. Configure Environment Variables
Inside `apps/backend/.env`, ensure you have your API keys set:
```env
W3W_API_KEY=YOUR_WHAT3WORDS_API_KEY
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
```

### 3. Start the Backend API
In a new terminal:
```bash
cd apps/backend
npm install
npm run start:dev
```
The NestJS server will start on `http://localhost:3000`.

### 4. Start the Frontend (Web)
In a new terminal:
```bash
cd apps/frontend
npm install
npm run dev
```
The Vite development server will start. Open the provided `localhost` link to use the web application.

### 5. Run the Mobile App (Capacitor)
If you want to run the project as a native mobile app on a simulator or physical device:
```bash
cd apps/frontend
npm run build
npx cap sync

# To open in Android Studio:
npx cap open android

# To open in Xcode (macOS only):
npx cap open ios
```
