import asyncio
import logging
from ..core.queue import consume_ride_requests
from ..core.redis import get_redis
from ..core.sio import sio
from ..core.database import SessionLocal
from ..models.all import Driver

logger = logging.getLogger(__name__)

async def start_driver_assignment_worker():
    logger.info("🚦 Driver Assignment Service started (Redis queue)")
    while True:
        try:
            # brpop blocks, so run it in a thread to keep the event loop free
            msg = await asyncio.to_thread(consume_ride_requests, 5)
            if not msg:
                continue
            data = {"id": msg.get("rideId"), **(msg.get("payload") or {})}
            await handle_ride_request(data)
        except asyncio.CancelledError:
            logger.info("Driver Assignment Service cancelled.")
            break
        except Exception as e:
            logger.error(f"Assignment worker error, retrying in 5s: {e}", exc_info=True)
            await asyncio.sleep(5)


async def handle_ride_request(data: dict):
    ride_id = data.get('id')
    category = data.get('category')
    pickup_lat = data.get('pickupLat')
    pickup_lng = data.get('pickupLng')

    if not all([ride_id, pickup_lat, pickup_lng]):
        logger.warning(f"Incomplete ride request data: {data}")
        return

    # Find nearest online driver via Redis GEOSEARCH
    r = get_redis()
    nearby = r.geosearch(
        name="driver_locations",
        longitude=pickup_lng,
        latitude=pickup_lat,
        radius=10,
        unit="km",
        withdist=True,
        sort="ASC"
    )

    if not nearby:
        logger.info(f"No drivers found near ride {ride_id}")
        return

    db = SessionLocal()
    try:
        for driver_id, dist in nearby:
            driver = db.query(Driver).filter(Driver.id == driver_id).first()
            if not driver:
                continue

            driver_category = getattr(driver, 'vehicleCategory', 'economy') or 'economy'
            if category and category != 'any' and driver_category != category:
                continue

            user_id = str(driver.userId)
            logger.info(f"📡 Dispatching Ride {ride_id} to Driver {user_id} ({dist:.2f}km away)")
            
            await sio.emit('job_offer', {
                "rideId": ride_id,
                "pickup": data.get("pickupWhat3words"),
                "destination": data.get("destinationWhat3words"),
                "fare": data.get("fare"),
                "distanceKm": round(dist, 2),
                "category": category
            }, room=user_id, namespace="/loc")
    except Exception as e:
        logger.error(f"Error dispatching ride {ride_id}: {e}", exc_info=True)
    finally:
        db.close()
