from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .core.database import engine, Base
from .routers import auth, rides, places, notifications, location, drivers, ws, admin
from .core.sio import sio_app
import asyncio
import time
from contextlib import asynccontextmanager
from sqlalchemy.exc import OperationalError
from .services.assignment import start_driver_assignment_worker
from .core.kafka import init_kafka, close_kafka

# Create tables — retry while postgres/networking is still coming up so a slow
# infra boot doesn't kill the process permanently
for _attempt in range(30):
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database connected, tables ensured", flush=True)
        break
    except OperationalError as exc:
        print(f"⏳ Database not ready (attempt {_attempt + 1}/30): {exc}", flush=True)
        time.sleep(2)
else:
    raise RuntimeError("Database unreachable after 60s — giving up")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Kafka (topic pre-creation, producer, location consumer).
    # A Kafka outage must not take the whole API down — auth/rides/places
    # still work without the dispatch pipeline.
    kafka_ok = False
    try:
        await init_kafka()
        kafka_ok = True
        asyncio.create_task(start_driver_assignment_worker())
    except Exception as exc:
        print(f"❌ Kafka init failed, continuing without dispatch pipeline: {exc}", flush=True)
    yield
    # Shutdown
    if kafka_ok:
        await close_kafka()

app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)


# Mount Socket.io
app.mount("/socket.io", sio_app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3000",
        # Production origins
        "https://kaalay.vercel.app",
        "https://app.suqafuran.com",
        "https://suqafuran.com",
        # Allow all vercel preview deployments
        "https://kaalay-git-main-bellonbits.vercel.app",
    ],
    allow_origin_regex=r"https://kaalay.*\.vercel\.app",  # covers all Vercel preview URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

V1_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=V1_PREFIX)
app.include_router(rides.router, prefix=V1_PREFIX)
app.include_router(places.router, prefix=V1_PREFIX)
app.include_router(notifications.router, prefix=V1_PREFIX)
app.include_router(location.router, prefix=V1_PREFIX)
app.include_router(drivers.router, prefix=V1_PREFIX)
app.include_router(admin.router, prefix=V1_PREFIX)
app.include_router(ws.router) # WS often doesn't need /api/v1 prefix but can have it. Keeping it clean at root /ws

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi import Request, status
from .core.redis import get_redis
import time

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Skip rate limiting for static assets or specific endpoints if needed
    if request.url.path.startswith("/socket.io"):
        return await call_next(request)
        
    client_ip = request.client.host if request.client else "unknown"
    r = get_redis()
    current_minute = int(time.time() // 60)
    redis_key = f"rate_limit:{client_ip}:{current_minute}"
    
    try:
        request_count = r.incr(redis_key)
        if request_count == 1:
            r.expire(redis_key, 60)
            
        if request_count > 100:
            print(f"FRAUD DETECTED: IP {client_ip} exceeded rate limit.")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Too many requests. Please slow down."}
            )
    except Exception as e:
        # Failsafe: If Redis is down, don't crash the API, just bypass rate limit
        print(f"Rate Limiter Redis Error: {e}")
        
    response = await call_next(request)
    return response

@app.middleware("http")
async def log_422_errors(request: Request, call_next):
    response = await call_next(request)
    if response.status_code == 422:
        print(f"DEBUG 422: Path={request.url.path} Method={request.method}")
        # We can't easily read the response body here without consume, but we can log the request
    return response

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    err_details = exc.errors()
    print(f"CRITICAL VALIDATION ERROR: {err_details}")
    return JSONResponse(
        status_code=422,
        content={"detail": err_details},
    )

@app.get("/")
async def root():
    return {"message": "Kaalay API v1 (FastAPI) is running", "version": "1.0.0"}
