# Kaalay — Ride-Hailing Platform

A ride-hailing and logistics platform optimised for Africa, using what3words for precise location addressing.

---

## Bottom Navigation & Screen Flow

```mermaid
stateDiagram-v2
    [*] --> Onboarding/Auth : Launch App
    Onboarding/Auth --> Navigate : Sign In / Register
    
    state Navigate {
        [*] --> MapHome : Enter home screen
        MapHome --> PlanJourney : Tap "Where to?"
        PlanJourney --> ConfirmPinSelection : Choose on Map
        ConfirmPinSelection --> RideSelect : Route Calculated
        RideSelect --> FindingDriver : Tap "Book Ride"
        FindingDriver --> ActiveRideTracking : Driver Assigned
        ActiveRideTracking --> Rating : Ride Completed
        Rating --> MapHome : Submit Review
    }

    state Meet {
        [*] --> SetupMeet : Create / Join Code
        SetupMeet --> LiveCoordinationMap : Session Active
        LiveCoordinationMap --> WalkToMeetingPoint : Dynamic Walking Route
    }

    state Share {
        [*] --> CreateShareSession : Set Expiry
        CreateShareSession --> LiveBroadcast : Broadcast Token
    }

    state SOS {
        [*] --> TriggerSOS : Tap "I'm Lost"
        TriggerSOS --> EmergencyBroadcasting : Pulse coordinates & alerts
    }

    state Profile {
        [*] --> ProfileSettings : Edit Details
        ProfileSettings --> GoOnlineOffline : Toggle Driver/Helper Status
    }

    Navigate --> Meet : Tapping bottom tabs
    Navigate --> Share : Tapping bottom tabs
    Navigate --> SOS : Tapping bottom tabs
    Navigate --> Profile : Tapping bottom tabs
    
    Meet --> Navigate : Switch Tab
    Share --> Navigate : Switch Tab
    SOS --> Navigate : Switch Tab
    Profile --> Navigate : Switch Tab
```

---

## Architecture Overview

```mermaid
graph TB
    subgraph Mobile["📱 Next.js Mobile Hub"]
        direction TB
        TAB1[Navigate Tab\nMap · Ride Booking]
        TAB2[Meet Tab\nGroup Coordination]
        TAB3[SOS Tab\nUrgent Help]
        TAB4[Share Tab\nBroadcast Coordinates]
        TAB5[Profile Tab\nAccount & Driver Mode]
    end

    subgraph Frontend["🖥️ Frontend — Next.js 15"]
        direction TB
        AppRouter[Next.js App Router]
        MapView[MapBase — Google Maps API]
        APIClient[Axios API Client]
        SocketClient[socket.io-client]
        GPS[useGeolocation Hook]
    end

    subgraph Backend["⚙️ Backend — FastAPI (Python)"]
        direction TB
        AuthMod[Auth Router\nJWT · Phone Login]
        RidesMod[Rides Router\nRide lifecycle]
        DriversMod[Drivers Router\nDriver statuses]
        LocationMod[Location Router\nwhat3words live API]
        DispatchMod[Assignment Worker\nDistributed matching]
        WS[Socket.IO Gateway\nReal-time events]
        KafkaMod[Kafka Producer/Consumer\nLocation pipeline]
    end

    subgraph Storage["🗄️ Storage"]
        PG[(PostgreSQL\nUsers · Drivers · Rides)]
        RD[(Redis\nDriver GEO locations)]
    end

    subgraph External["🌐 External APIs"]
        W3W[what3words API\nPrecise addressing]
        GM[Google Maps API\nRoutes API]
    end

    Mobile -->|renders| Frontend
    Frontend -->|HTTP REST| APIClient
    Frontend -->|real-time| SocketClient
    APIClient -->|requests| Backend
    SocketClient <-->|ws| WS

    AuthMod --> PG
    RidesMod --> PG
    DriversMod --> PG
    LocationMod -->|HTTPS| W3W
    DispatchMod --> RD
    WS --> RD
    WS --> KafkaMod
    KafkaMod --> RD

    MapView -->|HTTPS| GM
```

---

## Request Flow — Booking a Ride

```mermaid
sequenceDiagram
    actor Rider
    participant App as Next.js App
    participant API as FastAPI API
    participant W3W as what3words
    participant DB as PostgreSQL
    participant Redis
    participant WS as Socket.IO
    actor Driver

    Rider->>App: Enter destination / select grid
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

    loop Every 3s
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
        string vehicleCategory "economy | pro | help"
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

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile Shell | Capacitor (iOS + Android) |
| Frontend Framework | Next.js 15, React 19, TypeScript |
| UI Styling | TailwindCSS, Ant Design 6, @ant-design/icons |
| Maps & Routes | Google Maps JavaScript API, Google Routes API |
| Addressing | what3words live grid & geocoding API |
| Real-time | Socket.IO (client + python-socketio backend) |
| Backend Framework | FastAPI (Python 3.9), Uvicorn |
| Auth | JWT, stateless password hashing (bcrypt) |
| ORM | SQLAlchemy (v2.0) |
| Messaging Pipeline | Apache Kafka (aiokafka) |
| Database | PostgreSQL 15 |
| Cache & GEO Index | Redis 7 (GEOADD / GEORADIUS) |
| Infrastructure | Docker / Podman Compose |

---

## Project Structure

```
kaalay/
├── docker-compose.yml          # PostgreSQL + Redis + Kafka + Zookeeper + Adminer
├── apps/
│   ├── backend/                # FastAPI Application
│   │   ├── app/
│   │   │   ├── core/           # Config, DB, Security, Socket.io, Kafka
│   │   │   ├── models/         # SQLAlchemy all models
│   │   │   ├── schemas/        # Pydantic schemas
│   │   │   ├── services/       # Location services, assignment worker
│   │   │   ├── routers/        # Auth, Location, Rides, Drivers APIs
│   │   │   └── main.py         # Entrypoint
│   │   ├── venv/               # Python Virtual Environment
│   │   └── requirements.txt    # Python dependencies
│   └── frontend/               # Next.js 15 Web Application
│       ├── app/                # App Router screens (home, meet, ride, track, profile)
│       ├── components/         # MapBase, W3WMapOverlay, NavigationSheet
│       ├── context/            # AuthContext, ShareContext, LocationContext
│       ├── hooks/              # useGeolocation, useSocket
│       └── lib/                # api client, routeService
```

---

## How to Run

### 1. Start Infrastructure (PostgreSQL, Redis & Kafka)
Start the containers using [Podman](https://podman.io/docs/installation) or [Docker](https://docs.docker.com/engine/install/) from the root `kaalay` folder:
```bash
podman-compose up -d
# or
docker-compose up -d
```

### 2. Configure Environment Variables

**Backend (`apps/backend/.env`)**:
```env
PORT=3000
DATABASE_URL=postgresql://admin:password@localhost:5432/kaalay
REDIS_HOST=localhost
REDIS_PORT=6379
W3W_API_KEY=YOUR_WHAT3WORDS_API_KEY
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
```

**Frontend (`apps/frontend/.env.local`)**:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_WS_URL=http://localhost:3000
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
NEXT_PUBLIC_W3W_API_KEY=YOUR_WHAT3WORDS_API_KEY
```

### 3. Start the Backend API
From a new terminal:
```bash
cd apps/backend
./venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 3000 --reload
```
The FastAPI server will start on `http://localhost:3000` with Swagger docs available at `http://localhost:3000/docs`.

### 4. Start the Frontend (Next.js Dev Server)
From another terminal:
```bash
cd apps/frontend
npm run dev
```
The Next.js development server will start on `http://localhost:3001`. Open the link in your browser.

### 5. Run the Mobile App (Capacitor)
If you want to run the project as a native mobile app:
```bash
cd apps/frontend
npm run build
npx cap sync

# To open in Android Studio:
npx cap open android

# To open in Xcode (macOS only):
npx cap open ios
```
