import asyncio
from ..core.redis import get_redis
from ..core.queue import consume_ride_requests
from ..core.sio import sio_app
from ..core.database import SessionLocal
from ..models.all import Driver
import time

async def run_assignment_worker():
    print("🚀 Started Driver Assignment Service (Queue Worker)")
    r = get_redis()
    
    while True:
        try:
            # 1. Poll the Assignment Queue
            job = consume_ride_requests(timeout=2)
            if not job:
                await asyncio.sleep(1)
                continue
                
            ride_id = job.get("rideId")
            payload = job.get("payload")
            print(f"⚙️ Processing ride request event: {ride_id}")
            
            # 2. Distributed Lock (Prevent double-processing)
            lock_key = f"lock:assignment:{ride_id}"
            if not r.setnx(lock_key, "locked"):
                print(f"🔒 Ride {ride_id} is locked by another worker instance.")
                continue
            r.expire(lock_key, 60) # Lock expires in 60s
            
            # 3. Query Driver Location Cache (Redis GEO)
            pickup_lng = payload.get("pickupLng")
            pickup_lat = payload.get("pickupLat")
            
            nearby_drivers = r.geosearch(
                name="driver_locations",
                longitude=pickup_lng,
                latitude=pickup_lat,
                radius=10,
                unit="km",
                withdist=True,
                sort="ASC"
            )
            
            if not nearby_drivers:
                print(f"⚠️ No drivers found near ride {ride_id}")
                r.delete(lock_key)
                continue
                
            # 4. Push to Notification Service (Socket.IO)
            db = SessionLocal()
            for driver_id, dist in nearby_drivers:
                driver = db.query(Driver).filter(Driver.id == driver_id).first()
                if driver:
                    user_id = str(driver.userId)
                    print(f"📡 Dispatching Ride {ride_id} to Driver {user_id} ({dist}km away)")
                    
                    await sio_app.emit('job_offer', {
                        "rideId": ride_id,
                        "pickup": payload.get("pickupWhat3words"),
                        "destination": payload.get("destinationWhat3words"),
                        "fare": payload.get("fare"),
                        "distanceKm": round(dist, 2),
                        "category": payload.get("category", "economy")
                    }, room=user_id)
            
            db.close()
            
        except Exception as e:
            print(f"❌ Assignment worker error: {e}")
            await asyncio.sleep(2)
